# Narrow configuration boundary before any real model request

The v0.5 offline candidate and its publication are already fixed. This separate patch prepares an explicitly selected ignored local configuration for the existing single Chat Completions Gateway. It does not turn an environment file into provider/data/cost authority, inherit another project's budget, change account settings or dispatch a request by default.

Only CHAT_BASE_URL, CHAT_API_KEY and CHAT_MODEL are needed. No private app code, DB/Auth/OAuth settings, holdings or other service credentials belong in this project. Original synthetic fixture files are the only planned evaluation data. A user-provided key remains local and is never copied into build, evidence or publication artifacts.
