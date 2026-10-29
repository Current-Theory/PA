# Use Work Hub without development setup

[Download EarnLearn Work Hub](https://github.com/Current-Theory/PA/raw/refs/heads/main/downloads/EarnLearn-Work-Hub.zip)

1. Download the ZIP and **Extract All**.
2. Open **EarnLearn Work Hub.html** in **Microsoft Edge** or **Google Chrome**.
3. Capture a task, open its details, complete it and find it under Completed.

This packages the same React application into a single HTML file with its styles and scripts embedded. No Node, server, sign-in or Internet connection is required to try the task workflow. It uses fictional demo data; Microsoft 365 is not connected.

Keep the extracted file in the same folder and use the same browser profile. Tasks persist in that browser’s IndexedDB, not in the HTML. Don’t use private browsing if you want to keep changes. Corporate file/storage policies can block this mode. No PWA installation or live Microsoft sign-in is supported from a local file; those use the normal hosted build.

Regenerate this download from source using `npm ci && npm run build:portable`. The portable build deliberately removes Entra configuration and never registers a service worker for a file URL. The checked-in archive is generated output supplied for direct evaluation.
