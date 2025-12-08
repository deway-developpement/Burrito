pipeline {
  agent {
    kubernetes {
      defaultContainer 'builder'
      yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: builder
    image: node:18-bullseye
    tty: true
    command:
      - cat
    volumeMounts:
      - name: containerd-sock
        mountPath: /run/k3s/containerd/containerd.sock
        readOnly: true
  volumes:
    - name: containerd-sock
      hostPath:
        path: /run/k3s/containerd/containerd.sock
"""
    }
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    string(
      name: 'K8S_NAMESPACE',
      defaultValue: 'evaluation-system',
      description: 'Target Kubernetes namespace'
    )
    string(
      name: 'KUBE_CONTEXT',
      defaultValue: '',
      description: 'Optional kube-context override (leave empty to use default from kubeconfig)'
    )
  }

  environment {
    KUBECONFIG_CRED = 'kubeconfig-burrito' // secret-text credential containing kubeconfig
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        container('builder') {
          sh '''
            set -e
            # Install kubectl (lightweight)
            if ! command -v kubectl >/dev/null 2>&1; then
              curl -sLo /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
              chmod +x /usr/local/bin/kubectl
            fi
            # Install nerdctl (static binary)
            if ! command -v nerdctl >/dev/null 2>&1; then
              NERD_VERSION="1.7.7"
              curl -sL "https://github.com/containerd/nerdctl/releases/download/v${NERD_VERSION}/nerdctl-${NERD_VERSION}-linux-amd64.tar.gz" | tar -xz -C /usr/local/bin nerdctl
            fi
            cd backend
            npm ci --force
          '''
        }
      }
    }

    stage('Build Images (containerd local)') {
      steps {
        container('builder') {
          script {
            def services = ['api-gateway', 'users-ms', 'forms-ms', 'evaluations-ms']
            def tag = "${env.BUILD_NUMBER}"

            services.each { svc ->
              sh """
                set -e
                export CONTAINERD_SOCKET=/run/k3s/containerd/containerd.sock
                cd backend
                nerdctl --address \\$CONTAINERD_SOCKET --namespace k8s.io build --build-arg SERVICE_NAME=${svc} -t burrito-${svc}:${tag} .
                nerdctl --address \\$CONTAINERD_SOCKET --namespace k8s.io tag burrito-${svc}:${tag} burrito-${svc}:latest
              """
            }
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        container('builder') {
          withCredentials([string(credentialsId: env.KUBECONFIG_CRED, variable: 'KUBECONFIG_CONTENT')]) {
            sh '''
              set -e
              export KUBECONFIG=/tmp/kubeconfig
              printf "%s" "$KUBECONFIG_CONTENT" > "$KUBECONFIG"
              chmod 600 "$KUBECONFIG"

              if [ -n "$KUBE_CONTEXT" ]; then
                kubectl config use-context "$KUBE_CONTEXT"
              fi

              # Ensure base manifests are present
              kubectl apply -f backend/k8s/evaluation-system.yaml

              # Update deployments with freshly built images
              kubectl set image deployment/api-gateway api-gateway=burrito-api-gateway:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/users-ms users-ms=burrito-users-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/forms-ms forms-ms=burrito-forms-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/evaluations-ms evaluations-ms=burrito-evaluations-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"

              kubectl rollout status deployment/api-gateway -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/users-ms -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/forms-ms -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/evaluations-ms -n "$K8S_NAMESPACE"
            '''
          }
        }
      }
    }
  }
}
