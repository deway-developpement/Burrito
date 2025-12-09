pipeline {
  agent {
    kubernetes {
      yaml """
        apiVersion: v1
        kind: Pod
        spec:
          containers:
          - name: builder
            image: node:18-bullseye
            tty: true
            command: ["cat"]
        """
    }
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // Versions to install
    NERDCTL_VERSION = '2.2.0'

    // BuildKit service inside the jenkins namespace (ClusterIP Service "buildkit")
    BUILDKIT_HOST = 'tcp://buildkit:1234'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Build Tools') {
      steps {
        container('builder') {
          sh '''
            set -e
            # Install nerdctl (client)
            if ! command -v nerdctl >/dev/null 2>&1; then
              echo "Installing nerdctl..."
              curl -sL "https://github.com/containerd/nerdctl/releases/download/v${NERDCTL_VERSION}/nerdctl-${NERDCTL_VERSION}-linux-amd64.tar.gz" \
                | tar -xz -C /usr/local/bin nerdctl
            fi
          '''
        }
      }
    }

    stage('Build Local Images') {
      steps {
        container('builder') {
          sh '''
            set -e

            echo "Using BuildKit at: ${BUILDKIT_HOST}"

            cd backend

            # Define your services list here
            SERVICES="api-gateway users-ms forms-ms evaluations-ms"

            for svc in $SERVICES; do
              echo "-------------------------------------------------"
              echo "Building Service: $svc"
              echo "-------------------------------------------------"

              # nerdctl build talks to the remote BuildKit daemon
              nerdctl \
                build \
                --buildkit-host "${BUILDKIT_HOST}" \
                --build-arg SERVICE_NAME=${svc} \
                -t burrito-${svc}:${BUILD_NUMBER} \
                -t burrito-${svc}:latest \
                .
            done
          '''
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