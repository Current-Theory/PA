# Portable workspace evaluation

[Download Work Hub](https://github.com/Current-Theory/PA/raw/refs/heads/main/downloads/EarnLearn-Work-Hub.zip), **Extract All**, then open **EarnLearn Work Hub.html** in Edge/Chrome.

The same application now opens on Assistant. Secure in-app AI requires the hosted server; no API key belongs in this file. The download still supports manual Today/tasks/projects/history and recoverable Trash. It does not offer an external ChatGPT copy/import workflow.

Keep the same extracted file location and browser profile to retain records. Existing IDs/notes/history migrate without replacing the database. Settings can download a record backup (not an AI transcript export). Browser/device policy may block file-based apps or storage.

Build from source with `npm ci`, `npm ci --prefix api`, then `npm run build:portable`. Node is needed to build, not to open the extracted HTML. The checked-in ZIP is generated for direct evaluation; the primary connected assistant is the hosted/local-server version described in the main README.
