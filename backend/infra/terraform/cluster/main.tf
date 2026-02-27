locals {
  jenkins_namespace    = "jenkins"
  monitoring_namespace = "monitoring"
  argocd_namespace     = "argocd"
  app_namespace        = "evaluation-system"
  istio_namespace      = "istio-system"
  istio_chart_version  = "1.23.2"
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

resource "kubernetes_namespace" "istio_system" {
  metadata {
    name = local.istio_namespace
  }
}

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = local.argocd_namespace
  }
}

# Allow Jenkins (default SA in jenkins namespace) to deploy/patch monitoring stack
resource "kubernetes_cluster_role" "jenkins_monitoring_deployer" {
  metadata {
    name = "jenkins-monitoring-deployer"
  }

  rule {
    api_groups = ["monitoring.coreos.com"]
    resources  = ["servicemonitors", "podmonitors", "alertmanagerconfigs", "prometheusrules"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = [""]
    resources  = ["configmaps", "services", "serviceaccounts", "pods", "secrets", "nodes", "nodes/proxy"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "daemonsets", "statefulsets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  # Needed for promtail ClusterRole/ClusterRoleBinding in monitoring kustomize
  rule {
    api_groups = ["rbac.authorization.k8s.io"]
    resources  = ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

resource "kubernetes_cluster_role_binding" "jenkins_monitoring_deployer" {
  metadata {
    name = "jenkins-monitoring-deployer"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.jenkins_monitoring_deployer.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = "default"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
  }
}

# Allow Jenkins default SA to exec into the registry pod (jenkins namespace only).
resource "kubernetes_role" "jenkins_registry_exec" {
  metadata {
    name      = "jenkins-registry-exec"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
  }

  rule {
    api_groups = [""]
    resources  = ["pods/exec"]
    verbs      = ["create"]
  }
}

resource "kubernetes_role_binding" "jenkins_registry_exec" {
  metadata {
    name      = "jenkins-registry-exec"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.jenkins_registry_exec.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = "default"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
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

resource "kubernetes_manifest" "jenkins_https_redirect" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "https-redirect"
      namespace = kubernetes_namespace.jenkins.metadata[0].name
    }
    spec = {
      redirectScheme = {
        scheme    = "https"
        permanent = true
      }
    }
  }
}

resource "kubernetes_manifest" "monitoring_https_redirect" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "https-redirect"
      namespace = kubernetes_namespace.monitoring.metadata[0].name
    }
    spec = {
      redirectScheme = {
        scheme    = "https"
        permanent = true
      }
    }
  }
}

resource "kubernetes_manifest" "argocd_https_redirect" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "https-redirect"
      namespace = kubernetes_namespace.argocd.metadata[0].name
    }
    spec = {
      redirectScheme = {
        scheme    = "https"
        permanent = true
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
            "cert-manager.io/cluster-issuer"                   = "letsencrypt"
            "traefik.ingress.kubernetes.io/router.entrypoints" = "web,websecure"
            "traefik.ingress.kubernetes.io/router.middlewares" = "jenkins-https-redirect@kubernetescrd"
            "traefik.ingress.kubernetes.io/router.tls"         = "true"
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

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  namespace  = kubernetes_namespace.argocd.metadata[0].name
  skip_crds  = false

  values = [
    yamlencode({
      crds = {
        install = true
      }
      global = {
        domain = var.argocd_domain
      }
      server = {
        service = {
          type = "ClusterIP"
        }
        ingress = {
          enabled = false
        }
      }
      configs = {
        cm = {
          "kustomize.buildOptions" = "--load-restrictor LoadRestrictionsNone"
        }
        params = {
          "server.insecure" = true
        }
      }
    })
  ]

  depends_on = [kubernetes_manifest.letsencrypt_issuer]
}

resource "time_sleep" "wait_for_argocd_crds" {
  depends_on = [helm_release.argocd]

  # The Kubernetes API can acknowledge the Argo CD release before argoproj.io CRDs
  # are fully established. Wait briefly to avoid transient "kind not found" failures.
  create_duration = "45s"
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
            "cert-manager.io/cluster-issuer"                   = "letsencrypt"
            "traefik.ingress.kubernetes.io/router.entrypoints" = "web,websecure"
            "traefik.ingress.kubernetes.io/router.middlewares" = "monitoring-https-redirect@kubernetescrd"
            "traefik.ingress.kubernetes.io/router.tls"         = "true"
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
        prometheusSpec = {
          # Persist metrics across rollouts
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                accessModes = ["ReadWriteOnce"]
                resources = {
                  requests = {
                    storage = "10Gi"
                  }
                }
              }
            }
          }
        }
      }
      alertmanager = {
        ingress = {
          enabled = false
        }
        alertmanagerSpec = {
          alertmanagerConfigSelector = {
            matchLabels = {
              app = "burrito"
            }
          }
        }
      }
    })
  ]

  depends_on = [kubernetes_manifest.letsencrypt_issuer]
}

resource "helm_release" "istio_base" {
  name       = "istio-base"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "base"
  namespace  = kubernetes_namespace.istio_system.metadata[0].name
  version    = local.istio_chart_version
}

resource "helm_release" "istiod" {
  name       = "istiod"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "istiod"
  namespace  = kubernetes_namespace.istio_system.metadata[0].name
  version    = local.istio_chart_version

  depends_on = [helm_release.istio_base]
}

resource "terraform_data" "knative_serving" {
  triggers_replace = {
    kubeconfig_path = pathexpand(var.kubeconfig_path)
    knative_version = var.knative_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      KUBECONFIG="${pathexpand(var.kubeconfig_path)}"
      KNATIVE_VERSION="${var.knative_version}"

      kubectl --kubeconfig "$KUBECONFIG" apply -f "https://github.com/knative/serving/releases/download/$KNATIVE_VERSION/serving-crds.yaml"
      kubectl --kubeconfig "$KUBECONFIG" apply -f "https://github.com/knative/serving/releases/download/$KNATIVE_VERSION/serving-core.yaml"
      kubectl --kubeconfig "$KUBECONFIG" apply -f "https://github.com/knative/net-istio/releases/download/$KNATIVE_VERSION/net-istio.yaml"
      kubectl --kubeconfig "$KUBECONFIG" patch configmap/config-network -n knative-serving --type merge -p '{"data":{"ingress-class":"istio.ingress.networking.knative.dev"}}'
      kubectl --kubeconfig "$KUBECONFIG" patch configmap/config-observability -n knative-serving --type merge -p '{"data":{"metrics-protocol":"prometheus","metrics-endpoint":":9090","request-metrics-protocol":"prometheus","request-metrics-endpoint":":9091"}}'

      kubectl --kubeconfig "$KUBECONFIG" wait --for=condition=Established crd/services.serving.knative.dev --timeout=2m

      for deployment in $(kubectl --kubeconfig "$KUBECONFIG" -n knative-serving get deploy -o jsonpath='{.items[*].metadata.name}'); do
        kubectl --kubeconfig "$KUBECONFIG" -n knative-serving wait --for=condition=Available "deployment/$deployment" --timeout=5m
      done
    EOT
  }

  depends_on = [helm_release.istiod]
}

resource "terraform_data" "knative_eventing" {
  triggers_replace = {
    kubeconfig_path = pathexpand(var.kubeconfig_path)
    knative_version = var.knative_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      KUBECONFIG="${pathexpand(var.kubeconfig_path)}"
      KNATIVE_VERSION="${var.knative_version}"

      kubectl --kubeconfig "$KUBECONFIG" apply -f "https://github.com/knative/eventing/releases/download/$KNATIVE_VERSION/eventing-crds.yaml"
      kubectl --kubeconfig "$KUBECONFIG" apply -f "https://github.com/knative/eventing/releases/download/$KNATIVE_VERSION/eventing-core.yaml"

      kubectl --kubeconfig "$KUBECONFIG" wait --for=condition=Established crd/brokers.eventing.knative.dev --timeout=2m

      for deployment in $(kubectl --kubeconfig "$KUBECONFIG" -n knative-eventing get deploy -o jsonpath='{.items[*].metadata.name}'); do
        kubectl --kubeconfig "$KUBECONFIG" -n knative-eventing wait --for=condition=Available "deployment/$deployment" --timeout=5m
      done
    EOT
  }

  depends_on = [terraform_data.knative_serving]
}

resource "terraform_data" "knative_eventing_redis" {
  triggers_replace = {
    eventing_redis_version = var.eventing_redis_version
    kubeconfig_path        = pathexpand(var.kubeconfig_path)
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      KUBECONFIG="${pathexpand(var.kubeconfig_path)}"
      EVENTING_REDIS_VERSION="${var.eventing_redis_version}"

      kubectl --kubeconfig "$KUBECONFIG" apply -f "https://github.com/knative-extensions/eventing-redis/releases/download/$EVENTING_REDIS_VERSION/redis-source.yaml"

      kubectl --kubeconfig "$KUBECONFIG" wait --for=condition=Established crd/redisstreamsources.sources.knative.dev --timeout=2m

      for deployment in $(kubectl --kubeconfig "$KUBECONFIG" -n knative-sources get deploy -o jsonpath='{.items[*].metadata.name}'); do
        kubectl --kubeconfig "$KUBECONFIG" -n knative-sources wait --for=condition=Available "deployment/$deployment" --timeout=5m
      done
    EOT
  }

  depends_on = [terraform_data.knative_eventing]
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

resource "kubernetes_persistent_volume_claim" "registry" {
  metadata {
    name      = "registry-pvc"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "30Gi"
      }
    }
  }

  wait_until_bound = false
}

resource "kubernetes_deployment" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
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

          env {
            name  = "REGISTRY_STORAGE_DELETE_ENABLED"
            value = "true"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          readiness_probe {
            http_get {
              path = "/v2/"
              port = 5000
            }

            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          liveness_probe {
            http_get {
              path = "/v2/"
              port = 5000
            }

            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

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

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.registry.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.jenkins.metadata[0].name
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
    namespace = kubernetes_namespace.jenkins.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = "letsencrypt"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web,websecure"
      "traefik.ingress.kubernetes.io/router.middlewares" = "jenkins-https-redirect@kubernetescrd"
      "traefik.ingress.kubernetes.io/router.tls"         = "true"
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

resource "kubernetes_ingress_v1" "argocd" {
  metadata {
    name      = "argocd"
    namespace = kubernetes_namespace.argocd.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = "letsencrypt"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web,websecure"
      "traefik.ingress.kubernetes.io/router.middlewares" = "argocd-https-redirect@kubernetescrd"
      "traefik.ingress.kubernetes.io/router.tls"         = "true"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = var.argocd_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "argocd-server"

              port {
                number = 80
              }
            }
          }
        }
      }
    }

    tls {
      hosts       = [var.argocd_domain]
      secret_name = "argocd-tls"
    }
  }

  depends_on = [helm_release.argocd]
}

resource "kubernetes_namespace" "evaluation_system" {
  metadata {
    name = local.app_namespace
    labels = {
      # Keep consistent with backend/k8s/evaluation-system.yaml to avoid Terraform/ArgoCD drift.
      "istio-injection" = "enabled"
    }
  }

  lifecycle {
    ignore_changes = [
      metadata[0].annotations["argocd.argoproj.io/tracking-id"],
    ]
  }
}

resource "kubernetes_manifest" "argocd_project_burrito" {
  manifest = yamldecode(file("${path.module}/../../../k8s/argocd/appproject-burrito.yaml"))

  depends_on = [
    time_sleep.wait_for_argocd_crds,
    kubernetes_namespace.evaluation_system,
  ]
}

resource "kubernetes_manifest" "argocd_application_burrito_prod" {
  manifest = yamldecode(file("${path.module}/../../../k8s/argocd/application-burrito-prod.yaml"))
  computed_fields = [
    "metadata.annotations",
    "metadata.labels",
    "operation",
    "status",
    "object.operation",
    "object.status",
  ]

  depends_on = [
    kubernetes_manifest.argocd_project_burrito,
    kubernetes_namespace.evaluation_system,
  ]
}

resource "kubernetes_ingress_v1" "api_gateway" {
  metadata {
    name      = "api-gateway"
    namespace = kubernetes_namespace.evaluation_system.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = "letsencrypt"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web,websecure"
      "traefik.ingress.kubernetes.io/router.middlewares" = "evaluation-system-https-redirect@kubernetescrd"
      "traefik.ingress.kubernetes.io/router.tls"         = "true"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = var.api_gateway_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "api-gateway" # Service name in evaluation-system
              port {
                number = 80
              }
            }
          }
        }
      }
    }

    tls {
      hosts       = [var.api_gateway_domain]
      secret_name = "api-gateway-tls"
    }
  }
}

resource "kubernetes_role" "jenkins_deployer" {
  metadata {
    name      = "jenkins-deployer"
    namespace = kubernetes_namespace.evaluation_system.metadata[0].name
  }

  # Jenkins keeps operational access for secrets and one-off jobs only.
  # Argo CD owns application Deployments/Services/Ingress resources.

  rule {
    api_groups = ["batch"]
    resources = [
      "jobs",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }

  rule {
    api_groups = [""]
    resources = [
      "secrets",
      "pods",
      "pods/log",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }

  rule {
    api_groups = ["networking.istio.io"]
    resources = [
      "virtualservices",
      "destinationrules",
      "sidecars",
      "serviceentries",
      "gateways",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }

  rule {
    api_groups = ["security.istio.io"]
    resources = [
      "peerauthentications",
      "authorizationpolicies",
      "requestauthentications",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }
  rule {
    api_groups = ["traefik.io"]
    resources = [
      "middlewares",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }

  rule {
    api_groups = ["serving.knative.dev"]
    resources = [
      "services",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }

  rule {
    api_groups = ["sources.knative.dev"]
    resources = [
      "redisstreamsources",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }

  rule {
    api_groups = [""]
    resources = [
      "services",
      "configmaps",
      "secrets",
      "pods",
      "pods/log",
      "persistentvolumeclaims",
    ]
    verbs = [
      "get",
      "list",
      "watch",
      "create",
      "update",
      "patch",
      "delete",
    ]
  }
}

resource "kubernetes_role_binding" "jenkins_deployer_binding" {
  metadata {
    name      = "jenkins-deployer-binding"
    namespace = kubernetes_namespace.evaluation_system.metadata[0].name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.jenkins_deployer.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = "default" # SA name in the jenkins namespace
    namespace = kubernetes_namespace.jenkins.metadata[0].name
  }
}

resource "kubernetes_cluster_role" "jenkins_namespace_reader" {
  metadata {
    name = "jenkins-namespace-reader"
  }

  rule {
    api_groups = [""]
    resources  = ["namespaces"]
    verbs = [
      "get",
      "list",
      "watch",
      "patch",
      "update",
      "create",
    ]
  }
}

resource "kubernetes_cluster_role_binding" "jenkins_namespace_reader_binding" {
  metadata {
    name = "jenkins-namespace-reader-binding"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.jenkins_namespace_reader.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = "default" # same SA as in the error: jenkins:default
    namespace = kubernetes_namespace.jenkins.metadata[0].name
  }
}
