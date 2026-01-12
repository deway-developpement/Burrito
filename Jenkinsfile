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
            SERVICES="api-gateway users-ms forms-ms evaluations-ms analytics-ms groups-ms notifications-ms"

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
                --output type=image,\\"name=${REGISTRY_HOST}/burrito-${svc}:${BUILD_NUMBER},${REGISTRY_HOST}/burrito-${svc}:latest\\",push=true
            done

            echo "-------------------------------------------------"
            echo "Building Service: intelligence-ms"
            echo "-------------------------------------------------"

            buildctl \
              --addr "${BUILDKIT_HOST}" \
              build \
              --frontend dockerfile.v0 \
              --local context=apps/intelligence-ms \
              --local dockerfile=apps/intelligence-ms \
              --opt filename=Dockerfile \
              --output type=image,\\"name=${REGISTRY_HOST}/burrito-intelligence-ms:${BUILD_NUMBER},${REGISTRY_HOST}/burrito-intelligence-ms:latest\\",push=true

            cd ..

            echo "-------------------------------------------------"
            echo "Building Service: frontend"
            echo "-------------------------------------------------"

            buildctl \
              --addr "${BUILDKIT_HOST}" \
              build \
              --frontend dockerfile.v0 \
              --local context=burrito-front \
              --local dockerfile=burrito-front \
              --opt filename=Dockerfile \
              --output type=image,\\"name=${REGISTRY_HOST}/burrito-frontend:${BUILD_NUMBER},${REGISTRY_HOST}/burrito-frontend:latest\\",push=true
          '''
        }
      }
    }

    stage('Apply Secrets') {
      steps {
        container('builder') {
          withCredentials([
            string(credentialsId: 'burrito-database-username', variable: 'DATABASE_USERNAME'),
            string(credentialsId: 'burrito-database-password', variable: 'DATABASE_PASSWORD'),
            string(credentialsId: 'burrito-jwt-secret', variable: 'JWT_SECRET'),
            string(credentialsId: 'burrito-jwt-expires-in', variable: 'JWT_EXPIRES_IN'),
            string(credentialsId: 'burrito-jwt-refresh-expires-in', variable: 'JWT_REFRESH_EXPIRES_IN'),
            string(credentialsId: 'burrito-smtp-user', variable: 'SMTP_USER'),
            string(credentialsId: 'burrito-smtp-pass', variable: 'SMTP_PASS'),
            string(credentialsId: 'burrito-huggingface-hub-token', variable: 'HUGGINGFACE_HUB_TOKEN'),
          ]) {
            sh '''
              set -e

              kubectl create secret generic burrito-secrets \
                --from-literal=DATABASE_USERNAME="${DATABASE_USERNAME}" \
                --from-literal=DATABASE_PASSWORD="${DATABASE_PASSWORD}" \
                --from-literal=JWT_SECRET="${JWT_SECRET}" \
                --from-literal=JWT_EXPIRES_IN="${JWT_EXPIRES_IN}" \
                --from-literal=JWT_REFRESH_EXPIRES_IN="${JWT_REFRESH_EXPIRES_IN}" \
                --from-literal=SMTP_USER="${SMTP_USER}" \
                --from-literal=SMTP_PASS="${SMTP_PASS}" \
                --from-literal=HUGGINGFACE_HUB_TOKEN="${HUGGINGFACE_HUB_TOKEN}" \
                --dry-run=client -o yaml | kubectl apply -n "$K8S_NAMESPACE" -f -
            '''
          }
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
            kubectl apply -f backend/k8s/frontend.yaml

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

            kubectl set image deployment/analytics-ms \
              analytics-ms=${REGISTRY_HOST}/burrito-analytics-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/groups-ms \
              groups-ms=${REGISTRY_HOST}/burrito-groups-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/notifications-ms \
              notifications-ms=${REGISTRY_HOST}/burrito-notifications-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/intelligence-ms \
              intelligence-ms=${REGISTRY_HOST}/burrito-intelligence-ms:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            kubectl set image deployment/burrito-frontend \
              burrito-frontend=${REGISTRY_HOST}/burrito-frontend:${BUILD_NUMBER} \
              -n "$K8S_NAMESPACE"

            echo "Deployment updated successfully."

            kubectl rollout status deployment/api-gateway -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/users-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/forms-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/evaluations-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/analytics-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/groups-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/notifications-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/intelligence-ms -n "$K8S_NAMESPACE"
            kubectl rollout status deployment/burrito-frontend -n "$K8S_NAMESPACE"
          '''
        }
      }
    }

    stage('Deploy Monitoring') {
      steps {
        container('builder') {
          sh '''
            set -e

            # Deploy monitoring components (namespace and helm release are managed by Terraform)
            kubectl apply -k backend/k8s/monitoring
          '''
        }
      }
    }
  }
}
