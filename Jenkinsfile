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

    stage('Configure Git Trust') {
      steps {
        container('builder') {
          sh '''
            set -e
            git config --global --add safe.directory "$WORKSPACE" || true
            git config --global --add safe.directory "$(pwd)" || true
          '''
        }
      }
    }

    stage('Resolve Image Tag') {
      steps {
        script {
          def resolvedBuildNumber = "${currentBuild.number}".trim()
          if (!(resolvedBuildNumber ==~ /^[0-9]+$/)) {
            error "Invalid currentBuild.number '${resolvedBuildNumber}', refusing to tag/promote images."
          }
          env.IMAGE_TAG = resolvedBuildNumber
          echo "Resolved image tag: ${env.IMAGE_TAG} (raw BUILD_NUMBER='${env.BUILD_NUMBER ?: ''}')"
        }
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
                BUILD_INTELLIGENCE_FN=false
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
                          backend/apps/intelligence-fn-rs/*)
                            BUILD_INTELLIGENCE_FN=true
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
                  BUILD_INTELLIGENCE_FN=true
                  BUILD_FRONTEND=true
                fi

                if [ "$BUILD_BACKEND_ALL" = "true" ]; then
                  BUILD_SERVICES="$BACKEND_SERVICES"
                fi

                BUILD_SERVICES=$(echo "$BUILD_SERVICES" | tr ' ' '\n' | awk 'NF' | sort -u | tr '\n' ' ' | sed 's/ $//')

                printf 'BASE_COMMIT=%s\n' "$BASE_COMMIT"
                printf 'BUILD_ALL=%s\n' "$BUILD_ALL"
                printf 'BUILD_SERVICES=%s\n' "$BUILD_SERVICES"
                printf 'BUILD_INTELLIGENCE_FN=%s\n' "$BUILD_INTELLIGENCE_FN"
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
            env.BUILD_INTELLIGENCE_FN = props.BUILD_INTELLIGENCE_FN ?: 'false'
            env.BUILD_FRONTEND = props.BUILD_FRONTEND ?: 'false'

            echo "Base commit: ${env.BASE_COMMIT}"
            echo "Build services: ${env.BUILD_SERVICES}"
            echo "Build intelligence fn: ${env.BUILD_INTELLIGENCE_FN}"
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
                    --output 'type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-${serviceName}:${env.IMAGE_TAG},${env.REGISTRY_PUSH_HOST}/burrito-${serviceName}:latest",push=true,registry.insecure=true'
                """
              }
            }

            if (env.BUILD_INTELLIGENCE_FN == 'true') {
              tasks['build-intelligence-fn-rs'] = {
                sh """
                  set -e
                  echo "Building Service: intelligence-fn-rs"
                  buildctl \
                    --addr "${env.BUILDKIT_HOST}" \
                    build \
                    --frontend dockerfile.v0 \
                    --local context=backend/apps/intelligence-fn-rs \
                    --local dockerfile=backend/apps/intelligence-fn-rs \
                    --opt filename=Dockerfile \
                    --output 'type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-intelligence-fn-rs:${env.IMAGE_TAG},${env.REGISTRY_PUSH_HOST}/burrito-intelligence-fn-rs:latest",push=true,registry.insecure=true'
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
                    --output 'type=image,"name=${env.REGISTRY_PUSH_HOST}/burrito-frontend:${env.IMAGE_TAG},${env.REGISTRY_PUSH_HOST}/burrito-frontend:latest",push=true,registry.insecure=true'
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
          def hasArtifacts = (env.BUILD_SERVICES ?: '').trim() || env.BUILD_INTELLIGENCE_FN == 'true' || env.BUILD_FRONTEND == 'true'
          return branchName == sourceBranch && hasArtifacts
        }
      }
      steps {
        container('builder') {
          withCredentials([
            string(credentialsId: 'burrito-github-app-id', variable: 'GITHUB_APP_ID'),
            string(credentialsId: 'burrito-github-app-installation-id', variable: 'GITHUB_APP_INSTALLATION_ID'),
            string(credentialsId: 'burrito-github-app-private-key', variable: 'GITHUB_APP_PRIVATE_KEY'),
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
              git config user.name "jenkins-gitops[bot]"
              git config user.email "jenkins-gitops[bot]@users.noreply.github.com"

              if git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
                git checkout -B "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
                if ! git merge --no-edit "origin/${SOURCE_BRANCH}"; then
                  conflict_files="$(git diff --name-only --diff-filter=U)"
                  conflict_count="$(printf '%s\n' "${conflict_files}" | sed '/^$/d' | wc -l | tr -d ' ')"

                  if [ "${conflict_count}" -eq 1 ] && [ "${conflict_files}" = "${GITOPS_OVERLAY_PATH}" ]; then
                    echo "Merge conflict only on ${GITOPS_OVERLAY_PATH}; resolving with ${SOURCE_BRANCH} version before tag update."
                    git checkout --theirs "${GITOPS_OVERLAY_PATH}"
                    git add "${GITOPS_OVERLAY_PATH}"
                    git merge --continue
                  else
                    echo "Unresolved merge conflicts detected:" >&2
                    printf '%s\n' "${conflict_files}" >&2
                    exit 1
                  fi
                fi
              else
                git checkout -B "${TARGET_BRANCH}" "origin/${SOURCE_BRANCH}"
              fi

              PROMOTE_IMAGES=""
              for svc in ${BUILD_SERVICES}; do
                PROMOTE_IMAGES="${PROMOTE_IMAGES} burrito-${svc}"
              done
              if [ "${BUILD_INTELLIGENCE_FN}" = "true" ]; then
                PROMOTE_IMAGES="${PROMOTE_IMAGES} burrito-intelligence-fn-rs"
              fi
              if [ "${BUILD_FRONTEND}" = "true" ]; then
                PROMOTE_IMAGES="${PROMOTE_IMAGES} registry.burrito.deway.fr/burrito-frontend"
              fi
              PROMOTE_IMAGES="$(printf '%s\n' "${PROMOTE_IMAGES}" | tr ' ' '\n' | awk 'NF' | sort -u | tr '\n' ' ' | sed 's/ $//')"

              PROMOTE_IMAGES="${PROMOTE_IMAGES}" \
              BACKEND_SERVICES="${BACKEND_SERVICES}" \
              IMAGE_TAG="${IMAGE_TAG}" \
              GITOPS_OVERLAY_PATH="${GITOPS_OVERLAY_PATH}" \
              node <<'NODE'
              const fs = require('fs');

              const overlayPath = process.env.GITOPS_OVERLAY_PATH;
              const imageTag = (process.env.IMAGE_TAG || '').trim();
              const parseList = (value) =>
                (value || '')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean);

              if (!/^[0-9]+$/.test(imageTag)) {
                throw new Error(`Invalid IMAGE_TAG '${imageTag}'`);
              }

              const malformedLine = /^\s*(-?\.?nan|nan)\s*$/;
              const selectedImages = new Set(parseList(process.env.PROMOTE_IMAGES));
              const backendServices = parseList(process.env.BACKEND_SERVICES);

              const content = fs.readFileSync(overlayPath, 'utf8');
              const hasMalformed = content.split(/\r?\n/).some((line) => malformedLine.test(line));

              if (hasMalformed) {
                console.log(
                  `Detected malformed tag lines in ${overlayPath}; forcing full tag repair with IMAGE_TAG=${imageTag}.`,
                );
                for (const svc of backendServices) {
                  selectedImages.add(`burrito-${svc}`);
                }
                selectedImages.add('burrito-intelligence-fn-rs');
                selectedImages.add('registry.burrito.deway.fr/burrito-frontend');
              }

              if (selectedImages.size === 0) {
                console.log('No images selected for GitOps promotion.');
                process.exit(0);
              }

              const lines = content.split(/\r?\n/);
              const out = [];
              const updated = new Set();
              let currentImage = '';
              let inTarget = false;
              let tagIndent = '    ';

              const setTag = () => {
                out.push(`${tagIndent}newTag: "${imageTag}"`);
                updated.add(currentImage);
                inTarget = false;
              };

              for (const line of lines) {
                const nameMatch = line.match(/^(\s*)-\s+name:\s+(\S+)\s*$/);
                if (nameMatch) {
                  if (inTarget) {
                    setTag();
                  }
                  currentImage = nameMatch[2];
                  inTarget = selectedImages.has(currentImage);
                  tagIndent = `${nameMatch[1]}  `;
                  out.push(line);
                  continue;
                }

                if (inTarget && /^\s*newTag:\s*.*$/.test(line)) {
                  setTag();
                  continue;
                }

                if (inTarget && malformedLine.test(line)) {
                  setTag();
                  continue;
                }

                out.push(line);
              }

              if (inTarget) {
                setTag();
              }

              const missing = [...selectedImages].filter((image) => !updated.has(image));
              if (missing.length > 0) {
                throw new Error(
                  `Image entry not found in ${overlayPath}: ${missing.join(', ')}`,
                );
              }

              const rewritten = out.join('\n');
              if (rewritten.split(/\r?\n/).some((line) => malformedLine.test(line))) {
                throw new Error(
                  `Malformed tag lines remain in ${overlayPath} after rewrite.`,
                );
              }

              fs.writeFileSync(overlayPath, rewritten);
              console.log(`Updated ${updated.size} image entries to tag ${imageTag}.`);
NODE

              ensure_only_allowed_changes() {
                local changed_files=""
                local bad_file=0
                changed_files="$({ git diff --name-only; git diff --cached --name-only; } | sed '/^$/d' | sort -u)"
                if [ -z "${changed_files}" ]; then
                  return 0
                fi

                while IFS= read -r file; do
                  [ -z "${file}" ] && continue
                  if [ "${file}" != "${GITOPS_OVERLAY_PATH}" ]; then
                    echo "Unauthorized file change detected before push: ${file}" >&2
                    bad_file=1
                  fi
                done <<< "${changed_files}"

                if [ "${bad_file}" -ne 0 ]; then
                  exit 1
                fi
              }

              ensure_only_allowed_changes
              git add "${GITOPS_OVERLAY_PATH}"
              ensure_only_allowed_changes
              if ! git diff --cached --quiet; then
                git config user.name "jenkins-gitops[bot]"
                git config user.email "jenkins-gitops[bot]@users.noreply.github.com"
                git commit -m "ci: promote gitops images to ${IMAGE_TAG} [skip ci]"
              fi

              if git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
                if [ "$(git rev-list --count "origin/${TARGET_BRANCH}..HEAD")" -eq 0 ]; then
                  echo "No new commits to push to ${TARGET_BRANCH}."
                  exit 0
                fi
              fi

              APP_JWT="$(node <<'NODE'
              const crypto = require('crypto');

              function toBase64Url(input) {
                return Buffer.from(input)
                  .toString('base64')
                  .split('+').join('-')
                  .split('/').join('_')
                  .replace(/=+$/g, '');
              }

              const appId = (process.env.GITHUB_APP_ID || '').trim();
              let privateKey = process.env.GITHUB_APP_PRIVATE_KEY || '';
              if (!appId || !privateKey.trim()) {
                console.error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY.');
                process.exit(1);
              }

              privateKey = privateKey
                .split(String.fromCharCode(92) + 'n')
                .join(String.fromCharCode(10));

              const now = Math.floor(Date.now() / 1000);
              const header = { alg: 'RS256', typ: 'JWT' };
              const payload = { iat: now - 60, exp: now + 540, iss: appId };
              const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
              const signature = crypto
                .createSign('RSA-SHA256')
                .update(unsignedToken)
                .end()
                .sign(privateKey, 'base64')
                .split('+').join('-')
                .split('/').join('_')
                .replace(/=+$/g, '');
              process.stdout.write(`${unsignedToken}.${signature}`);
NODE
              )"

              if [ -z "${APP_JWT}" ]; then
                echo "Failed to generate GitHub App JWT." >&2
                exit 1
              fi

              INSTALLATION_TOKEN="$(curl -fsSL \
                -X POST \
                -H "Authorization: Bearer ${APP_JWT}" \
                -H "Accept: application/vnd.github+json" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                "https://api.github.com/app/installations/${GITHUB_APP_INSTALLATION_ID}/access_tokens" \
                | node -e 'const fs=require("fs"); const raw=fs.readFileSync(0,"utf8"); let data; try { data=JSON.parse(raw); } catch (err) { console.error("Unable to parse installation token response."); process.exit(1); } if (!data.token) { console.error("GitHub installation token response missing token field."); process.exit(1); } process.stdout.write(data.token);')"

              if [ -z "${INSTALLATION_TOKEN}" ]; then
                echo "Failed to fetch GitHub installation token." >&2
                exit 1
              fi

              ORIGIN_URL="$(git remote get-url origin)"
              case "${ORIGIN_URL}" in
                https://*)
                  AUTH_URL="$(echo "${ORIGIN_URL}" | sed "s#^https://#https://x-access-token:${INSTALLATION_TOKEN}@#")"
                  ;;
                http://*)
                  AUTH_URL="$(echo "${ORIGIN_URL}" | sed "s#^http://#http://x-access-token:${INSTALLATION_TOKEN}@#")"
                  ;;
                *)
                  echo "Unsupported origin URL for GitHub App token auth: ${ORIGIN_URL}" >&2
                  exit 1
                  ;;
              esac

              git remote set-url origin "${AUTH_URL}"
              trap 'git remote set-url origin "${ORIGIN_URL}" >/dev/null 2>&1 || true' EXIT

              git push origin HEAD:${TARGET_BRANCH}

              git remote set-url origin "${ORIGIN_URL}"
              trap - EXIT
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

            # Use in-cluster config (service account)
            kubectl get crd services.serving.knative.dev >/dev/null
            kubectl get crd redisstreamsources.sources.knative.dev >/dev/null
            kubectl apply -f backend/k8s/evaluation-system.yaml
            kubectl apply -f backend/k8s/intelligence-fn-rs.knative.yaml
            kubectl apply -f backend/k8s/frontend.yaml
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
          script {
            def services = (env.BUILD_SERVICES ?: '').tokenize(' ') as Set
            def updateImage = { String deployment, String image ->
              sh """
                kubectl set image deployment/${deployment} \
                  ${deployment}=${env.REGISTRY_HOST}/${image}:${env.IMAGE_TAG} \
                  -n "\$K8S_NAMESPACE"
              """
            }
            def restart = { String deployment ->
              sh """
                kubectl rollout restart deployment/${deployment} -n "\$K8S_NAMESPACE"
              """
            }
            def rollout = { String deployment ->
              sh """
                kubectl rollout status deployment/${deployment} -n "\$K8S_NAMESPACE" --timeout=5m
              """
            }
            def updateKnativeImage = { String serviceName, String image ->
              sh """
                kubectl patch kservice/${serviceName} \
                  -n "\$K8S_NAMESPACE" \
                  --type=merge \
                  -p '{"spec":{"template":{"metadata":{"annotations":{"burrito/build-number":"${env.IMAGE_TAG}"}},"spec":{"containers":[{"image":"${env.REGISTRY_HOST}/${image}:${env.IMAGE_TAG}"}]}}}}'
              """
            }
            def rolloutKnative = { String serviceName ->
              sh """
                kubectl wait --for=condition=Ready kservice/${serviceName} -n "\$K8S_NAMESPACE" --timeout=5m
              """
            }

            if (services.contains('api-gateway')) {
              updateImage('api-gateway', 'burrito-api-gateway')
              restart('api-gateway')
            }
            if (services.contains('users-ms')) {
              updateImage('users-ms', 'burrito-users-ms')
              restart('users-ms')
            }
            if (services.contains('forms-ms')) {
              updateImage('forms-ms', 'burrito-forms-ms')
              restart('forms-ms')
            }
            if (services.contains('evaluations-ms')) {
              updateImage('evaluations-ms', 'burrito-evaluations-ms')
              restart('evaluations-ms')
            }
            if (services.contains('analytics-ms')) {
              updateImage('analytics-ms', 'burrito-analytics-ms')
              restart('analytics-ms')
            }
            if (services.contains('groups-ms')) {
              updateImage('groups-ms', 'burrito-groups-ms')
              restart('groups-ms')
            }
            if (services.contains('notifications-ms')) {
              updateImage('notifications-ms', 'burrito-notifications-ms')
              restart('notifications-ms')
            }
            if (env.BUILD_INTELLIGENCE_FN == 'true') {
              updateKnativeImage('intelligence-fn-rs', 'burrito-intelligence-fn-rs')
            }
            if (env.BUILD_FRONTEND == 'true') {
              updateImage('burrito-frontend', 'burrito-frontend')
              restart('burrito-frontend')
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
            if (env.BUILD_INTELLIGENCE_FN == 'true') {
              rolloutKnative('intelligence-fn-rs')
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
