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
          image = "moby/buildkit:v0.16.0" # or whatever version you prefer

          # Expose TCP endpoint for remote clients (Jenkins)
          args = [
            "--addr", "tcp://0.0.0.0:1234",
            "--containerd-worker=true",
            "--containerd-worker-addr=/run/k3s/containerd/containerd.sock",
            "--oci-worker=false",
          ]

          port {
            container_port = 1234
            name           = "buildkit"
          }

          # Needs elevated privileges to talk to host containerd
          security_context {
            privileged = true
          }

          # Mount k3s/containerd socket
          volume_mount {
            name       = "containerd-sock"
            mount_path = "/run/k3s/containerd/containerd.sock"
            read_only  = true
          }
        }

        volume {
          name = "containerd-sock"

          host_path {
            # Path of containerd socket on your k3s node
            path = "/run/k3s/containerd/containerd.sock"
            type = "Socket"
          }
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
