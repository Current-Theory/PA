# Visual decisions and assumptions

Reference inspected: **EL 4204 – Electrical Apprentice Handbook (digital)**, September 2026; rendered cover and contents page. The PDF is a visual reference, not application instructions, and is not redistributed.

- The handbook uses a deep navy field, white EarnLearn wordmark, lime emphasis, angular cropped imagery, plus motifs and strong typography.
- The working app translates those cues into a navy sidebar, quiet white/grey surfaces, subdued teal actions and a small lime focus accent. No electrical imagery is used on working screens.
- Provisional tokens are in `src/styles.css`: navy `#102c37`, teal `#216d6b`, aqua `#72c9c3`, lime `#b8dd76`. These are interpretations and **are not official sampled corporate values**.
- The app uses an available system sans-serif stack for reliable offline rendering and Windows integration. The handbook’s editorial serif titles were not copied into dense task controls.
- The EarnLearn text wordmark and E/plus app icons are placeholders, not a reproduction of an approved corporate logo. Request approved SVG assets, fonts and brand specifications before organisational launch.
- A deliberately compact sidebar and roomy rows support a work monitor, with a 450px desktop detail drawer and full-width narrow-screen drawer. Mobile navigation collapses.
- Status is communicated using text and icons as well as colour. Lime is reserved for sparse focus/brand emphasis; primary action buttons use teal.

Validate final palette/logo/font treatment with the EarnLearn brand owner and perform manual accessibility and actual-device checks before production use. The automated browser suite also checks contrast, dialogs and mobile overflow.
