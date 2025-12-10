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
    BUILDKIT_VERSION = '0.26.2'
    KUBECTL_VERSION  = 'v1.34.1'

    // BuildKit service inside the jenkins namespace (ClusterIP Service "buildkit")
    BUILDKIT_HOST = 'tcp://buildkit:1234'
    REGISTRY_HOST = 'registry.burrito.deway.fr'
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
            # Install buildctl (BuildKit client required by nerdctl)
            if ! command -v buildctl >/dev/null 2>&1; then
              echo "Installing buildctl..."
              curl -sL "https://github.com/moby/buildkit/releases/download/v${BUILDKIT_VERSION}/buildkit-v${BUILDKIT_VERSION}.linux-amd64.tar.gz" \
                | tar -xz -C /usr/local
            fi

            # Install kubectl
            if ! command -v kubectl >/dev/null 2>&1; then
              echo "Installing kubectl..."
              curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
              install -m 0755 kubectl /usr/local/bin/kubectl
              rm kubectl
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

              # Use buildctl directly to talk to the remote BuildKit daemon
              buildctl \
                --addr "${BUILDKIT_HOST}" \
                build \
                --frontend dockerfile.v0 \
                --local context=. \
                --local dockerfile=. \
                --opt filename=Dockerfile \
                --opt "build-arg:SERVICE_NAME=${svc}" \
                --output type=image,"name=${REGISTRY_HOST}/burrito-${svc}:${BUILD_NUMBER},${REGISTRY_HOST}/burrito-${svc}:latest",push=true
            done
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        container('builder') {
          sh '''
            set -e

            # Use in-cluster config (service account)
            kubectl apply -f backend/k8s/evaluation-system.yaml

            kubectl set image deployment/api-gateway \
              api-gateway=${REGISTRY_HOST}/burrito-api-gateway:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/users-ms \
              users-ms=${REGISTRY_HOST}/burrito-users-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/forms-ms \
              forms-ms=${REGISTRY_HOST}/burrito-forms-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/evaluations-ms \
              evaluations-ms=${REGISTRY_HOST}/burrito-evaluations-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            echo "Deployment updated successfully."

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