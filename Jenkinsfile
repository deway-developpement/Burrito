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
    choice(name: 'ISTIO_MTLS_PHASE', choices: ['permissive', 'strict'], description: 'Istio mTLS rollout phase for app workloads.')
  }

  environment {
    // Versions to install
    BUILDKIT_VERSION = '0.26.2'
    KUBECTL_VERSION  = 'v1.34.1'

    // BuildKit service inside the jenkins namespace (ClusterIP Service "buildkit")
    BUILDKIT_HOST = 'tcp://buildkit:1234'
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
                ensure_commit() {
                  local commit="$1"
                  if [ -z "$commit" ]; then
                    return 1
                  fi
                  if git cat-file -e "${commit}^{commit}" 2>/dev/null; then
                    return 0
                  fi
                  local origin_url=""
                  origin_url=$(git remote get-url origin 2>/dev/null || true)
                  if [ -z "$origin_url" ] && [ -n "$GIT_URL" ]; then
                    origin_url="$GIT_URL"
                  fi
                  if [ -z "$origin_url" ] && [ -n "$GIT_URL_1" ]; then
                    origin_url="$GIT_URL_1"
                  fi
                  if [ -n "$origin_url" ]; then
                    git remote add origin "$origin_url" >/dev/null 2>&1 || git remote set-url origin "$origin_url" >/dev/null 2>&1 || true
                  fi

                  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null || echo false)" = "true" ]; then
                    for depth in 10 25 50 100 200; do
                      echo "Fetching additional history (depth ${depth}) to find ${commit}..."
                      if [ -n "$origin_url" ]; then
                        git fetch --deepen="${depth}" origin >/dev/null 2>&1 || git fetch --deepen="${depth}" "$origin_url" >/dev/null 2>&1 || true
                      else
                        git fetch --deepen="${depth}" origin >/dev/null 2>&1 || true
                      fi
                      if git cat-file -e "${commit}^{commit}" 2>/dev/null; then
                        return 0
                      fi
                    done
                  fi

                  if [ -n "$origin_url" ]; then
                    git fetch origin "${commit}" >/dev/null 2>&1 || git fetch "$origin_url" "${commit}" >/dev/null 2>&1 || true
                  else
                    git fetch origin "${commit}" >/dev/null 2>&1 || true
                  fi
                  git cat-file -e "${commit}^{commit}" 2>/dev/null
                }
                if [ "$FORCE_BUILD_ALL" = "true" ]; then
                  BUILD_ALL=true
                else
                  if [ -n "$GIT_PREVIOUS_SUCCESSFUL_COMMIT" ] && ensure_commit "$GIT_PREVIOUS_SUCCESSFUL_COMMIT"; then
                    BASE_COMMIT="$GIT_PREVIOUS_SUCCESSFUL_COMMIT"
                  elif [ -n "$GIT_PREVIOUS_COMMIT" ] && ensure_commit "$GIT_PREVIOUS_COMMIT"; then
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
                    --output 'type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-${serviceName}:${env.BUILD_NUMBER},${env.REGISTRY_PUSH_HOST}/burrito-${serviceName}:latest",push=true,registry.insecure=true'
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
                    --output 'type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-intelligence-ms:${env.BUILD_NUMBER},${env.REGISTRY_PUSH_HOST}/burrito-intelligence-ms:latest",push=true,registry.insecure=true'
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
                    --output 'type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-frontend:${env.BUILD_NUMBER},${env.REGISTRY_PUSH_HOST}/burrito-frontend:latest",push=true,registry.insecure=true'
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

    stage('Promote GitOps') {
      when {
        expression {
          def sourceBranch = 'main'
          def branchName = env.BRANCH_NAME ?: sourceBranch
          def hasArtifacts = (env.BUILD_SERVICES ?: '').trim() || env.BUILD_INTELLIGENCE == 'true' || env.BUILD_FRONTEND == 'true'
          return branchName == sourceBranch && hasArtifacts
        }
      }
      steps {
        container('builder') {
          withCredentials([
            string(credentialsId: 'burrito-git-push-token', variable: 'GIT_PUSH_TOKEN'),
          ]) {
            sh '''#!/usr/bin/env bash
              set -euo pipefail

              GITOPS_OVERLAY_PATH="backend/k8s/overlays/prod/kustomization.yaml"
              SOURCE_BRANCH="main"
              TARGET_BRANCH="production"

              if [ ! -f "${GITOPS_OVERLAY_PATH}" ]; then
                echo "Missing GitOps overlay file: ${GITOPS_OVERLAY_PATH}" >&2
                exit 1
              fi

              git fetch origin "${SOURCE_BRANCH}" "${TARGET_BRANCH}" || git fetch origin "${SOURCE_BRANCH}"

              if git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
                git checkout -B "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
                git merge --no-edit "origin/${SOURCE_BRANCH}"
              else
                git checkout -B "${TARGET_BRANCH}" "origin/${SOURCE_BRANCH}"
              fi

              update_tag() {
                local image_name="$1"
                local image_tag="$2"

                rc=0
                awk -v image="${image_name}" -v tag="${image_tag}" '
                  BEGIN { in_target = 0; updated = 0 }
                  $1 == "-" && $2 == "name:" && $3 == image {
                    in_target = 1
                    print
                    next
                  }
                  in_target == 1 && $1 == "newTag:" {
                    sub(/newTag:[[:space:]]*.*/, "newTag: " tag)
                    in_target = 0
                    updated = 1
                    print
                    next
                  }
                  { print }
                  END {
                    if (updated == 0) {
                      exit 42
                    }
                  }
                ' "${GITOPS_OVERLAY_PATH}" > "${GITOPS_OVERLAY_PATH}.tmp" || rc=$?
                if [ "${rc}" -ne 0 ]; then
                  rm -f "${GITOPS_OVERLAY_PATH}.tmp"
                  if [ "${rc}" -eq 42 ]; then
                    echo "Image entry not found in ${GITOPS_OVERLAY_PATH}: ${image_name}" >&2
                  fi
                  exit "${rc}"
                fi

                mv "${GITOPS_OVERLAY_PATH}.tmp" "${GITOPS_OVERLAY_PATH}"
              }

              for svc in ${BUILD_SERVICES}; do
                update_tag "burrito-${svc}" "${BUILD_NUMBER}"
              done

              if [ "${BUILD_INTELLIGENCE}" = "true" ]; then
                update_tag "burrito-intelligence-ms" "${BUILD_NUMBER}"
              fi

              if [ "${BUILD_FRONTEND}" = "true" ]; then
                update_tag "registry.burrito.deway.fr/burrito-frontend" "${BUILD_NUMBER}"
              fi

              git add "${GITOPS_OVERLAY_PATH}"
              if ! git diff --cached --quiet; then
                git config user.name "Jenkins"
                git config user.email "jenkins@burrito.local"
                git commit -m "ci: promote gitops images to ${BUILD_NUMBER} [skip ci]"
              fi

              if git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
                if [ "$(git rev-list --count "origin/${TARGET_BRANCH}..HEAD")" -eq 0 ]; then
                  echo "No new commits to push to ${TARGET_BRANCH}."
                  exit 0
                fi
              fi

              ORIGIN_URL="$(git remote get-url origin)"
              AUTH_URL=""
              if [ -n "${GIT_PUSH_TOKEN}" ]; then
                case "${ORIGIN_URL}" in
                  https://*)
                    AUTH_URL="$(echo "${ORIGIN_URL}" | sed "s#^https://#https://x-access-token:${GIT_PUSH_TOKEN}@#")"
                    ;;
                  http://*)
                    AUTH_URL="$(echo "${ORIGIN_URL}" | sed "s#^http://#http://x-access-token:${GIT_PUSH_TOKEN}@#")"
                    ;;
                  *)
                    echo "GIT_PUSH_TOKEN provided, but remote URL is not HTTP(S). Using existing origin auth."
                    ;;
                esac
              fi

              if [ -n "${AUTH_URL}" ]; then
                git remote set-url origin "${AUTH_URL}"
                trap 'git remote set-url origin "${ORIGIN_URL}" >/dev/null 2>&1 || true' EXIT
              fi

              git push origin HEAD:${TARGET_BRANCH}

              if [ -n "${AUTH_URL}" ]; then
                git remote set-url origin "${ORIGIN_URL}"
                trap - EXIT
              fi
            '''
          }
        }
      }
    }

    stage('Apply Istio mTLS Policies') {
      when {
        branch 'main'
      }
      steps {
        container('builder') {
          sh '''
            set -e

            kubectl apply -f backend/k8s/istio/peer-authn-global-permissive.yaml
            kubectl apply -f backend/k8s/istio/peer-authn-data-permissive.yaml

            case "${ISTIO_MTLS_PHASE}" in
              strict)
                kubectl apply -f backend/k8s/istio/peer-authn-apps-strict.yaml
                ;;
              permissive)
                kubectl delete -f backend/k8s/istio/peer-authn-apps-strict.yaml --ignore-not-found=true || true
                ;;
              *)
                echo "Invalid ISTIO_MTLS_PHASE=${ISTIO_MTLS_PHASE}. Allowed values: permissive|strict"
                exit 1
                ;;
            esac
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
