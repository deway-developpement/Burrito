locals {
  jenkins_namespace    = "jenkins"
  monitoring_namespace = "monitoring"
  app_namespace        = "app"
  traefik_cluster_ip   = data.kubernetes_service.traefik.spec[0].cluster_ip
}

data "kubernetes_service" "traefik" {
  metadata {
    name      = "traefik"
    namespace = "kube-system"
  }
}

resource "kubernetes_namespace" "jenkins" {
  metadata {
    name = local.jenkins_namespace
  }
}

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = local.monitoring_namespace
  }
}

resource "kubernetes_namespace" "app" {
  metadata {
    name = local.app_namespace
  }
}

resource "kubernetes_manifest" "letsencrypt_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "letsencrypt"
    }
    spec = {
      acme = {
        email  = var.acme_email
        server = "https://acme-v02.api.letsencrypt.org/directory"
        privateKeySecretRef = {
          name = "letsencrypt-key"
        }
        solvers = [
          {
            http01 = {
              ingress = {
                ingressClassName = "traefik"
                ingressTemplate = {
                  metadata = {
                    annotations = {
                      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
                      "traefik.ingress.kubernetes.io/router.tls"         = "false"
                      "traefik.ingress.kubernetes.io/router.priority"    = "1000"
                    }
                  }
                }
              }
            }
          }
        ]
      }
    }
  }
}

resource "helm_release" "jenkins" {
  name       = "jenkins"
  repository = "https://charts.jenkins.io"
  chart      = "jenkins"
  namespace  = kubernetes_namespace.jenkins.metadata[0].name
  version    = "5.8.110"

  values = [
    yamlencode({
      controller = {
        admin = {
          username = var.jenkins_admin_user
          password = var.jenkins_admin_password
        }
        image = {
          repository = "jenkins/jenkins"
          tag        = "2.528.2-lts-jdk17"
        }
        installPlugins = [
          "configuration-as-code",
          "git",
          "git-client",
          "workflow-aggregator",
          "workflow-basic-steps",
          "workflow-cps",
          "workflow-durable-task-step",
          "workflow-step-api",
          "pipeline-model-definition",
          "credentials",
          "credentials-binding",
          "ssh-credentials",
          "kubernetes",
          "kubernetes-credentials",
          "durable-task",
          "apache-httpcomponents-client-4-api"
        ]
        jenkinsUrl  = "https://${var.jenkins_domain}"
        serviceType = "ClusterIP"
        ingress = {
          enabled          = true
          hostName         = var.jenkins_domain
          ingressClassName = "traefik"
          annotations = {
            "cert-manager.io/cluster-issuer" = "letsencrypt"
          }
          tls = [
            {
              secretName = "jenkins-tls"
              hosts      = [var.jenkins_domain]
            }
          ]
        }
        persistence = {
          size = var.jenkins_storage_size
        }
      }
    })
  ]

  depends_on = [kubernetes_manifest.letsencrypt_issuer]
}

resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "79.11.0"

  values = [
    yamlencode({
      grafana = {
        adminPassword = var.grafana_admin_password
        ingress = {
          enabled          = true
          ingressClassName = "traefik"
          hosts            = [var.grafana_domain]
          annotations = {
            "cert-manager.io/cluster-issuer" = "letsencrypt"
          }
          tls = [
            {
              secretName = "grafana-tls"
              hosts      = [var.grafana_domain]
            }
          ]
        }
      }
      prometheus = {
        ingress = {
          enabled = false
        }
      }
      alertmanager = {
        ingress = {
          enabled = false
        }
      }
    })
  ]

  depends_on = [kubernetes_manifest.letsencrypt_issuer]
}

resource "kubernetes_deployment" "buildkitd" {
  metadata {
    name      = "buildkitd"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
    labels = {
      app = "buildkitd"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "buildkitd"
      }
    }

    template {
      metadata {
        labels = {
          app = "buildkitd"
        }
      }

      spec {
        container {
          name  = "buildkitd"
          image = "moby/buildkit:latest" # or whatever version you prefer

          # Expose TCP endpoint for remote clients (Jenkins)
          args = [
            "--addr", "tcp://0.0.0.0:1234",
            "--oci-worker=true",
            "--containerd-worker=false",
          ]

          port {
            container_port = 1234
            name           = "buildkit"
          }

          security_context {
            privileged = true
          }

          # Simple cache directory inside the pod
          volume_mount {
            name       = "buildkit-cache"
            mount_path = "/var/lib/buildkit"
            read_only  = false
          }
        }

        volume {
          name = "buildkit-cache"

          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "buildkitd" {
  metadata {
    name      = "buildkit"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
    labels = {
      app = "buildkitd"
    }
  }

  spec {
    selector = {
      app = "buildkitd"
    }

    port {
      name        = "buildkit"
      port        = 1234
      target_port = 1234
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_deployment" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels = {
      app = "registry"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "registry"
      }
    }

    template {
      metadata {
        labels = {
          app = "registry"
        }
      }

      spec {
        container {
          name  = "registry"
          image = "registry:2"

          port {
            container_port = 5000
            name           = "registry"
          }

          volume_mount {
            name       = "registry-storage"
            mount_path = "/var/lib/registry"
          }
        }

        volume {
          name = "registry-storage"

          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels = {
      app = "registry"
    }
  }

  spec {
    selector = {
      app = "registry"
    }

    port {
      name        = "registry"
      port        = 5000
      target_port = 5000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_ingress_v1" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.app.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer" = "letsencrypt"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = var.registry_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.registry.metadata[0].name

              port {
                number = 5000
              }
            }
          }
        }
      }
    }

    tls {
      hosts       = [var.registry_domain]
      secret_name = "registry-tls"
    }
  }
}
