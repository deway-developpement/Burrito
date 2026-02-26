#!/usr/bin/env python3
"""backend/scripts/list_form_candidate_students.py

PoC helper: list candidate students for a form who actually responded.

Given an authenticated account (email/password) that can read the form,
this script:
1) Fetches the form's groups and their members (candidate set).
2) Calls Form.userRespondedToForm(userId: ...) for each member (batched).
3) Prints only the names of students who responded.
4) Optionally polls every 5s and logs newly detected submissions.

Usage:
  python3 backend/scripts/list_form_candidate_students.py \
    --endpoint https://api.example.com/graphQL \
    --email "student@example.com" \
    --password "..." \
    --form-id "$FORM_ID"

You can also omit --endpoint/--form-id if you set:
  GRAPHQL_URL (or API_BASE_URL) and FORM_ID
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
import time
import datetime
import urllib.error
import urllib.request
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple


FORM_MEMBERS_QUERY = """
query FormCandidateStudents($formId: ID!) {
  me { id userType }
  form(id: $formId) {
    id
    title
    groups {
      id
      name
      members {
        id
        email
        fullName
        userType
      }
    }
  }
}
""".strip()

EVALUATIONS_FOR_FORM_QUERY = """
query EvaluationsForForm($formId: String!) {
  evaluations(
    filter: { formId: { eq: $formId } }
    sorting: [{ field: createdAt, direction: DESC }]
    paging: { first: 500 }
  ) {
    edges {
      node {
        id
        createdAt
        respondentToken
      }
    }
  }
}
""".strip()


def post_json(url: str, payload: Dict[str, Any], timeout_s: int = 30) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {raw}") from e


def derive_auth_url(graphql_endpoint: str) -> str:
    """
    The frontend and scripts use:
      GRAPHQL: {API_BASE_URL}/graphQL (or /graphql)
      AUTH:    {API_BASE_URL}/auth/login
    """
    p = urllib.parse.urlsplit(graphql_endpoint)
    path = p.path or ""
    for suffix in ("/graphQL", "/graphql"):
        if path.endswith(suffix):
            base_path = path[: -len(suffix)] or ""
            new_path = (base_path.rstrip("/") + "/auth/login") or "/auth/login"
            return urllib.parse.urlunsplit((p.scheme, p.netloc, new_path, "", ""))
    # Fall back to swapping the last segment; keeps things working for uncommon paths.
    base_path = path.rsplit("/", 1)[0] if "/" in path else ""
    new_path = (base_path.rstrip("/") + "/auth/login") or "/auth/login"
    return urllib.parse.urlunsplit((p.scheme, p.netloc, new_path, "", ""))


def login_and_get_access_token(graphql_endpoint: str, email: str, password: str) -> str:
    auth_url = derive_auth_url(graphql_endpoint)
    resp = post_json(auth_url, {"email": email, "password": password})
    token = resp.get("access_token")
    if not isinstance(token, str) or not token.strip():
        raise RuntimeError("Login succeeded but no access_token was returned.")
    return token.strip()


def resolve_graphql_endpoint(endpoint_arg: Optional[str]) -> str:
    if isinstance(endpoint_arg, str) and endpoint_arg.strip():
        return endpoint_arg.strip()
    env = os.environ.get("GRAPHQL_URL") or os.environ.get("GRAPHQL_ENDPOINT")
    if isinstance(env, str) and env.strip():
        return env.strip()
    api_base = os.environ.get("API_BASE_URL")
    if isinstance(api_base, str) and api_base.strip():
        return api_base.rstrip("/") + "/graphQL"
    raise RuntimeError("Missing GraphQL endpoint. Pass --endpoint or set GRAPHQL_URL/API_BASE_URL.")


def post_graphql(endpoint: str, token: str, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(endpoint, data=body, method="POST")
    req.add_header("content-type", "application/json")
    req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {raw}") from e


def chunked(xs: List[Any], size: int) -> List[List[Any]]:
    return [xs[i : i + size] for i in range(0, len(xs), size)]


def extract_candidate_users(
    resp: Dict[str, Any],
) -> Tuple[
    Optional[str],
    Optional[str],
    Optional[str],
    Optional[str],
    List[Tuple[str, str, str]],
]:
    if resp.get("errors"):
        raise RuntimeError(f"GraphQL errors: {resp['errors']}")

    data = resp.get("data") if isinstance(resp, dict) else None
    me = (data or {}).get("me") if isinstance(data, dict) else None
    form = (data or {}).get("form") if isinstance(data, dict) else None

    me_id = me.get("id") if isinstance(me, dict) else None
    me_type = me.get("userType") if isinstance(me, dict) else None

    if not isinstance(form, dict):
        raise RuntimeError("Form not found or not accessible for this token.")

    form_id = form.get("id")
    form_title = form.get("title")

    users: List[Tuple[str, str, str]] = []
    groups = form.get("groups") or []
    if not isinstance(groups, list):
        groups = []

    for g in groups:
        if not isinstance(g, dict):
            continue
        members = g.get("members") or []
        if not isinstance(members, list):
            continue
        for m in members:
            if not isinstance(m, dict):
                continue
            if m.get("userType") != "STUDENT":
                continue
            uid = m.get("id")
            if not uid:
                continue
            email = m.get("email")
            full_name = m.get("fullName")
            if isinstance(full_name, str) and full_name.strip():
                name = full_name.strip()
            else:
                name = "<missing fullName>"
            if isinstance(email, str) and email.strip():
                email_s = email.strip()
            else:
                email_s = "<missing email>"
            users.append((str(uid), name, email_s))

    # de-dupe (by userId), stable order
    seen = set()
    out: List[Tuple[str, str, str]] = []
    for uid, name, email in users:
        if uid in seen:
            continue
        seen.add(uid)
        out.append((uid, name, email))

    return (
        me_id,
        me_type,
        str(form_id) if form_id is not None else None,
        str(form_title) if form_title is not None else None,
        out,
    )


def build_oracle_query_for_chunk(user_ids: List[str]) -> str:
    fields: List[str] = []
    for i, uid in enumerate(user_ids):
        alias = f"r{i}"
        uid_literal = json.dumps(uid)  # safely quoted GraphQL string literal
        fields.append(f"{alias}: userRespondedToForm(userId: {uid_literal})")
    return "\n    ".join(fields)


def oracle_check_chunk(endpoint: str, token: str, form_id: str, user_ids: List[str]) -> List[bool]:
    fields = build_oracle_query_for_chunk(user_ids)
    query = f"""
query Oracle($formId: ID!) {{
  form(id: $formId) {{
    id
    {fields}
  }}
}}
""".strip()

    resp = post_graphql(endpoint, token, query, {"formId": form_id})
    if resp.get("errors"):
        raise RuntimeError(f"GraphQL errors in Oracle query: {resp['errors']}")

    form = ((resp.get("data") or {}).get("form") or {})
    if not isinstance(form, dict):
        raise RuntimeError("Form not found in oracle query response.")

    results: List[bool] = []
    for i in range(len(user_ids)):
        v = form.get(f"r{i}")
        results.append(bool(v) if isinstance(v, bool) else False)
    return results


def fetch_form_evaluations(endpoint: str, token: str, form_id: str) -> List[Dict[str, str]]:
    resp = post_graphql(endpoint, token, EVALUATIONS_FOR_FORM_QUERY, {"formId": form_id})
    if resp.get("errors"):
        raise RuntimeError(f"GraphQL errors in evaluations query: {resp['errors']}")

    edges = (((resp.get("data") or {}).get("evaluations") or {}).get("edges")) or []
    if not isinstance(edges, list):
        return []

    out: List[Dict[str, str]] = []
    for e in edges:
        node = e.get("node") if isinstance(e, dict) else None
        if not isinstance(node, dict):
            continue
        eid = node.get("id")
        created_at = node.get("createdAt")
        respondent_token = node.get("respondentToken")
        if isinstance(eid, str) and eid.strip():
            out.append(
                {
                    "id": eid,
                    "createdAt": str(created_at) if created_at is not None else "",
                    "respondentToken": str(respondent_token) if respondent_token is not None else "",
                }
            )
    return out


def fetch_responded_user_ids(
    endpoint: str,
    token: str,
    form_id: str,
    candidates: List[Tuple[str, str, str]],
    chunk_size: int,
) -> List[str]:
    responded: List[str] = []
    for part in chunked(candidates, chunk_size):
        part_ids = [uid for uid, _, _ in part]
        flags = oracle_check_chunk(endpoint, token, form_id, part_ids)
        for (uid, _, _), ok in zip(part, flags):
            if ok:
                responded.append(uid)
    return responded


def iso_now_utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def monitor_form(
    endpoint: str,
    token: str,
    email: str,
    password: str,
    form_id: str,
    chunk_size: int,
    poll_seconds: float,
) -> int:
    # Mapping evaluation->user is not directly available via GraphQL because evaluations store a hashed
    # respondentToken (HMAC(userId+formId)). We can still detect newly-responded users and newly-created
    # evaluations, and pair them when counts are 1:1.
    try:
        resp = post_graphql(endpoint, token, FORM_MEMBERS_QUERY, {"formId": form_id})
        me_id, me_type, _, form_title, candidates = extract_candidate_users(resp)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    user_by_id = {uid: (name, em) for uid, name, em in candidates}
    try:
        responded_list = fetch_responded_user_ids(endpoint, token, form_id, candidates, chunk_size)
        responded_ids = set(responded_list)
        evals = fetch_form_evaluations(endpoint, token, form_id)
    except Exception as e:
        print(f"ERROR: initial fetch failed: {e}", file=sys.stderr)
        return 2

    seen_responded = set(responded_ids)
    seen_eval_ids = set(e.get("id") for e in evals if e.get("id"))

    print("Monitoring form for new submissions (polling)")
    print(f"now={iso_now_utc()}")
    print(f"me.id={me_id} me.userType={me_type}")
    print(f"formId={form_id}")
    if form_title:
        print(f"title={form_title}")
    print(f"pollSeconds={poll_seconds}")
    print(f"candidates={len(candidates)} alreadyResponded={len(seen_responded)} existingEvaluations={len(seen_eval_ids)}")
    sys.stdout.flush()

    pending_users: List[str] = []
    pending_evals: List[Dict[str, str]] = []

    next_tick = time.monotonic()
    while True:
        next_tick += max(0.1, poll_seconds)
        sleep_s = max(0.0, next_tick - time.monotonic())
        time.sleep(sleep_s)

        # Refresh token if needed (access tokens can be short lived).
        try:
            resp = post_graphql(endpoint, token, FORM_MEMBERS_QUERY, {"formId": form_id})
            _, _, _, _, candidates = extract_candidate_users(resp)
            user_by_id = {uid: (name, em) for uid, name, em in candidates}
            responded_list = fetch_responded_user_ids(endpoint, token, form_id, candidates, chunk_size)
            evals_now = fetch_form_evaluations(endpoint, token, form_id)
        except Exception as e:
            msg = str(e)
            if "HTTP 401" in msg or "Unauthorized" in msg:
                try:
                    token = login_and_get_access_token(endpoint, email, password)
                    continue
                except Exception as e2:
                    print(f"{iso_now_utc()} ERROR: re-login failed: {e2}", file=sys.stderr)
                    return 2
            print(f"{iso_now_utc()} ERROR: poll failed: {e}", file=sys.stderr)
            continue

        new_users = [uid for uid in responded_list if uid not in seen_responded]
        if new_users:
            seen_responded |= set(new_users)
            pending_users.extend(new_users)

        new_evals = [e for e in evals_now if e.get("id") and e.get("id") not in seen_eval_ids]
        if new_evals:
            for e in new_evals:
                seen_eval_ids.add(e["id"])
            # Newest first from the query; map in chronological order.
            pending_evals.extend(reversed(new_evals))

        # Map evaluationId -> user. If multiple occurred between polls, this is best-effort pairing.
        mapped_any = False
        if pending_users and pending_evals and len(pending_users) == len(pending_evals):
            tag = "NEW_SUBMISSION" if len(pending_users) == 1 else "NEW_SUBMISSION_BEST_EFFORT"
            for _ in range(len(pending_users)):
                mapped_any = True
                uid = pending_users.pop(0)
                ev = pending_evals.pop(0)
                name, em = user_by_id.get(uid, ("<unknown name>", "<unknown email>"))
                print(
                    f"{iso_now_utc()} {tag} evaluationId={ev.get('id')} createdAt={ev.get('createdAt')} "
                    f"userId={uid} email={em} name={name}"
                )

        if mapped_any:
            sys.stdout.flush()
            continue

        # If something changed but we can't map (multiple in-flight), log state once per change.
        if new_users or new_evals:
            user_bits: List[str] = []
            for uid in pending_users:
                name, em = user_by_id.get(uid, ("<unknown name>", "<unknown email>"))
                user_bits.append(f"{uid}:{em}:{name}")
            eval_bits = [f"{e.get('id')}@{e.get('createdAt')}" for e in pending_evals]
            print(
                f"{iso_now_utc()} PENDING pendingUsers={len(pending_users)} pendingEvals={len(pending_evals)} "
                f"users={user_bits} evals={eval_bits}"
            )
            sys.stdout.flush()


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="List student names for a form, filtered to those who responded.")
    p.add_argument("--endpoint", default=None,
                   help="GraphQL endpoint, e.g. https://api.example.com/graphQL (or set GRAPHQL_URL/API_BASE_URL)")
    p.add_argument("--email", required=True, help="Account email used to login")
    p.add_argument("--password", default=None, help="Account password (omit to be prompted)")
    p.add_argument("--form-id", default=None, help="Form id (or set FORM_ID)")
    p.add_argument("--chunk-size", type=int, default=50,
                   help="UserIds per GraphQL request to userRespondedToForm (default: 50)")
    p.add_argument("--poll-seconds", type=float, default=5.0,
                   help="Polling interval in seconds when monitoring (default: 5)")
    p.add_argument("--once", action="store_true",
                   help="Run once and print the current responded list (no polling)")
    p.add_argument("--json", action="store_true",
                   help="Machine-readable output")
    args = p.parse_args(argv)

    chunk_size = max(1, min(int(args.chunk_size), 200))
    poll_seconds = float(args.poll_seconds) if args.poll_seconds is not None else 5.0
    poll_seconds = 5.0 if poll_seconds <= 0 else poll_seconds
    password = args.password if isinstance(args.password, str) else None
    if not password:
        password = getpass.getpass("Password: ")
    try:
        endpoint = resolve_graphql_endpoint(args.endpoint)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    form_id = args.form_id or os.environ.get("FORM_ID")
    if not isinstance(form_id, str) or not form_id.strip():
        print("ERROR: Missing form id. Pass --form-id or set FORM_ID.", file=sys.stderr)
        return 2
    form_id = form_id.strip()

    try:
        token = login_and_get_access_token(endpoint, args.email, password)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    if not args.once and not args.json:
        try:
            return monitor_form(
                endpoint=endpoint,
                token=token,
                email=args.email,
                password=password,
                form_id=form_id,
                chunk_size=chunk_size,
                poll_seconds=poll_seconds,
            )
        except KeyboardInterrupt:
            print(f"{iso_now_utc()} stopped (KeyboardInterrupt)")
            return 0

    try:
        resp = post_graphql(endpoint, token, FORM_MEMBERS_QUERY, {"formId": form_id})
        me_id, me_type, form_id, form_title, candidates = extract_candidate_users(resp)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    responded_names: List[str] = []
    for part in chunked(candidates, chunk_size):
        part_ids = [uid for uid, _, _ in part]
        try:
            flags = oracle_check_chunk(endpoint, token, form_id, part_ids)
        except Exception as e:
            print(f"ERROR: oracle check failed: {e}", file=sys.stderr)
            return 2
        for (_, name, _), ok in zip(part, flags):
            if ok:
                responded_names.append(name)

    # de-dupe + sort for stable output
    responded_names = sorted(set(responded_names), key=lambda s: s.lower())

    if args.json:
        print(
            json.dumps(
                {
                    "me": {"id": me_id, "userType": me_type},
                    "formId": form_id,
                    "formTitle": form_title,
                    "candidateStudentCount": len(candidates),
                    "respondedStudentCount": len(responded_names),
                    "respondedStudentNames": responded_names,
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print("Students who responded to form")
        print(f"me.id={me_id} me.userType={me_type}")
        print(f"formId={form_id}")
        if form_title:
            print(f"title={form_title}")
        print(f"candidates={len(candidates)}")
        print(f"responded={len(responded_names)}")
        for n in responded_names:
            print(f"- {n}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
