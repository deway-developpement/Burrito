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

  parameters {
    booleanParam(name: 'FORCE_BUILD_ALL', defaultValue: false, description: 'Build all images regardless of detected changes.')
  }

  environment {
    // Versions to install
    BUILDKIT_VERSION = '0.26.2'
    KUBECTL_VERSION  = 'v1.34.1'

    // BuildKit service inside the jenkins namespace (ClusterIP Service "buildkit")
    BUILDKIT_HOST = 'tcp://buildkit:1234'
    REGISTRY_HOST = 'registry.burrito.deway.fr'
    REGISTRY_PUSH_HOST = 'registry.jenkins.svc.cluster.local:5000'
    BACKEND_SERVICES = 'api-gateway users-ms forms-ms evaluations-ms analytics-ms groups-ms notifications-ms'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Compute Build Targets') {
      steps {
        container('builder') {
          script {
            def output = sh(
              returnStdout: true,
              script: '''
                set -e

                BUILD_ALL=false
                BUILD_BACKEND_ALL=false
                BUILD_SERVICES=""
                BUILD_INTELLIGENCE=false
                BUILD_FRONTEND=false

                BASE_COMMIT=""
                if [ "$FORCE_BUILD_ALL" = "true" ]; then
                  BUILD_ALL=true
                else
                  if [ -n "$GIT_PREVIOUS_SUCCESSFUL_COMMIT" ] && git cat-file -e "$GIT_PREVIOUS_SUCCESSFUL_COMMIT^{commit}" 2>/dev/null; then
                    BASE_COMMIT="$GIT_PREVIOUS_SUCCESSFUL_COMMIT"
                  elif [ -n "$GIT_PREVIOUS_COMMIT" ] && git cat-file -e "$GIT_PREVIOUS_COMMIT^{commit}" 2>/dev/null; then
                    BASE_COMMIT="$GIT_PREVIOUS_COMMIT"
                  fi

                  if [ -z "$BASE_COMMIT" ]; then
                    BUILD_ALL=true
                  else
                    CHANGED_FILES=$(git diff --name-only "$BASE_COMMIT"...HEAD)
                    if [ -n "$CHANGED_FILES" ]; then
                      printf '%s\n' "$CHANGED_FILES" > .changed_files
                      while IFS= read -r file; do
                        case "$file" in
                          backend/apps/intelligence-ms/proto/*)
                            BUILD_INTELLIGENCE=true
                            BUILD_BACKEND_ALL=true
                            ;;
                          backend/apps/intelligence-ms/*)
                            BUILD_INTELLIGENCE=true
                            ;;
                          backend/apps/*)
                            svc=$(echo "$file" | cut -d/ -f3)
                            case " $BACKEND_SERVICES " in
                              *" $svc "*) BUILD_SERVICES="$BUILD_SERVICES $svc";;
                            esac
                            ;;
                          backend/libs/*|backend/package.json|backend/package-lock.json|backend/tsconfig*.json|backend/nest-cli.json|backend/Dockerfile|backend/wait-for-it.sh|backend/eslint.config.mjs|backend/schema.gql|backend/infra/*|backend/scripts/*)
                            BUILD_BACKEND_ALL=true
                            ;;
                          burrito-front/*)
                            BUILD_FRONTEND=true
                            ;;
                        esac
                      done < .changed_files
                      rm -f .changed_files
                    fi
                  fi
                fi

                if [ "$BUILD_ALL" = "true" ]; then
                  BUILD_SERVICES="$BACKEND_SERVICES"
                  BUILD_INTELLIGENCE=true
                  BUILD_FRONTEND=true
                fi

                if [ "$BUILD_BACKEND_ALL" = "true" ]; then
                  BUILD_SERVICES="$BACKEND_SERVICES"
                fi

                BUILD_SERVICES=$(echo "$BUILD_SERVICES" | tr ' ' '\n' | awk 'NF' | sort -u | tr '\n' ' ' | sed 's/ $//')

                printf 'BASE_COMMIT=%s\n' "$BASE_COMMIT"
                printf 'BUILD_ALL=%s\n' "$BUILD_ALL"
                printf 'BUILD_SERVICES=%s\n' "$BUILD_SERVICES"
                printf 'BUILD_INTELLIGENCE=%s\n' "$BUILD_INTELLIGENCE"
                printf 'BUILD_FRONTEND=%s\n' "$BUILD_FRONTEND"
              '''
            ).trim()

            def props = [:]
            if (output) {
              output.split('\n').each { line ->
                def idx = line.indexOf('=')
                if (idx > 0) {
                  props[line.substring(0, idx)] = line.substring(idx + 1)
                }
              }
            }

            env.BASE_COMMIT = props.BASE_COMMIT ?: ''
            env.BUILD_ALL = props.BUILD_ALL ?: 'false'
            env.BUILD_SERVICES = props.BUILD_SERVICES ?: ''
            env.BUILD_INTELLIGENCE = props.BUILD_INTELLIGENCE ?: 'false'
            env.BUILD_FRONTEND = props.BUILD_FRONTEND ?: 'false'

            echo "Base commit: ${env.BASE_COMMIT}"
            echo "Build services: ${env.BUILD_SERVICES}"
            echo "Build intelligence: ${env.BUILD_INTELLIGENCE}"
            echo "Build frontend: ${env.BUILD_FRONTEND}"
          }
        }
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
          script {
            def tasks = [:]
            def services = (env.BUILD_SERVICES ?: '').tokenize(' ')

            services.each { svc ->
              def serviceName = svc
              tasks["build-${serviceName}"] = {
                sh """
                  set -e
                  echo "Building Service: ${serviceName}"
                  buildctl \
                    --addr "${env.BUILDKIT_HOST}" \
                    build \
                    --frontend dockerfile.v0 \
                    --local context=backend \
                    --local dockerfile=backend \
                    --opt filename=Dockerfile \
                    --opt "build-arg:SERVICE_NAME=${serviceName}" \
                    --output type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-${serviceName}:${env.BUILD_NUMBER},${env.REGISTRY_PUSH_HOST}/burrito-${serviceName}:latest",push=true,registry.insecure=true
                """
              }
            }

            if (env.BUILD_INTELLIGENCE == 'true') {
              tasks['build-intelligence-ms'] = {
                sh """
                  set -e
                  echo "Building Service: intelligence-ms"
                  buildctl \
                    --addr "${env.BUILDKIT_HOST}" \
                    build \
                    --frontend dockerfile.v0 \
                    --local context=backend/apps/intelligence-ms \
                    --local dockerfile=backend/apps/intelligence-ms \
                    --opt filename=Dockerfile \
                    --output type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-intelligence-ms:${env.BUILD_NUMBER},${env.REGISTRY_PUSH_HOST}/burrito-intelligence-ms:latest",push=true,registry.insecure=true
                """
              }
            }

            if (env.BUILD_FRONTEND == 'true') {
              tasks['build-frontend'] = {
                sh """
                  set -e
                  echo "Building Service: frontend"
                  buildctl \
                    --addr "${env.BUILDKIT_HOST}" \
                    build \
                    --frontend dockerfile.v0 \
                    --local context=burrito-front \
                    --local dockerfile=burrito-front \
                    --opt filename=Dockerfile \
                    --output type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-frontend:${env.BUILD_NUMBER},${env.REGISTRY_PUSH_HOST}/burrito-frontend:latest",push=true,registry.insecure=true
                """
              }
            }

            if (tasks.isEmpty()) {
              echo 'No images to build.'
            } else {
              parallel tasks
            }
          }
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
          '''
          script {
            def services = (env.BUILD_SERVICES ?: '').tokenize(' ') as Set
            def updateImage = { String deployment, String image ->
              sh """
                kubectl set image deployment/${deployment} \
                  ${deployment}=${env.REGISTRY_HOST}/${image}:${env.BUILD_NUMBER} \
                  -n "\$K8S_NAMESPACE"
              """
            }
            def rollout = { String deployment ->
              sh """
                kubectl rollout status deployment/${deployment} -n "\$K8S_NAMESPACE"
              """
            }

            if (services.contains('api-gateway')) {
              updateImage('api-gateway', 'burrito-api-gateway')
            }
            if (services.contains('users-ms')) {
              updateImage('users-ms', 'burrito-users-ms')
            }
            if (services.contains('forms-ms')) {
              updateImage('forms-ms', 'burrito-forms-ms')
            }
            if (services.contains('evaluations-ms')) {
              updateImage('evaluations-ms', 'burrito-evaluations-ms')
            }
            if (services.contains('analytics-ms')) {
              updateImage('analytics-ms', 'burrito-analytics-ms')
            }
            if (services.contains('groups-ms')) {
              updateImage('groups-ms', 'burrito-groups-ms')
            }
            if (services.contains('notifications-ms')) {
              updateImage('notifications-ms', 'burrito-notifications-ms')
            }
            if (env.BUILD_INTELLIGENCE == 'true') {
              updateImage('intelligence-ms', 'burrito-intelligence-ms')
            }
            if (env.BUILD_FRONTEND == 'true') {
              updateImage('burrito-frontend', 'burrito-frontend')
            }

            if (services.contains('api-gateway')) {
              rollout('api-gateway')
            }
            if (services.contains('users-ms')) {
              rollout('users-ms')
            }
            if (services.contains('forms-ms')) {
              rollout('forms-ms')
            }
            if (services.contains('evaluations-ms')) {
              rollout('evaluations-ms')
            }
            if (services.contains('analytics-ms')) {
              rollout('analytics-ms')
            }
            if (services.contains('groups-ms')) {
              rollout('groups-ms')
            }
            if (services.contains('notifications-ms')) {
              rollout('notifications-ms')
            }
            if (env.BUILD_INTELLIGENCE == 'true') {
              rollout('intelligence-ms')
            }
            if (env.BUILD_FRONTEND == 'true') {
              rollout('burrito-frontend')
            }
          }
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
