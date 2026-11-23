# Privacy Policy — FiveNet for Stream Deck

Last updated: 2026-11-10

FiveNet for Stream Deck is a community plugin that connects the Stream Deck app to a
FiveNet (FiveM) server. This page explains which data the plugin processes and where
that data is stored.

## Data processed

- **Server address**: the URL of the FiveNet server you configure.
- **Account credentials**: username and password, plus the session token returned by
  the server.
- **Character selection**: the ID and display name of the active character.
- **Live data**: units, dispatches, and notifications fetched from your server while
  the plugin is running.
- **Action settings**: the configuration of the keys you place on your Stream Deck.

## Where data is stored

- All settings are stored **locally on your computer** by the Stream Deck app, as part
  of the plugin's global and action settings.
- Credentials are stored locally so the plugin can log in again automatically when a
  session expires. They are never sent to the plugin author.
- The plugin does not operate any backend service and does not store data in the cloud.

## Data transmission

- Data is sent **only to the FiveNet server you configure**, using the server's
  HTTPS/WSS endpoints.
- The plugin contains no analytics, telemetry, tracking, or advertising SDKs, and does
  not contact third-party services.

## Retention and deletion

- Settings remain on your computer until you change or remove them.
- To delete the stored credentials, open the plugin's Login property inspector and clear
  the fields, or remove the plugin and its settings from Stream Deck.
- Uninstalling the plugin removes its local settings. Data stored on the FiveNet server
  is controlled by the operator of that server.

## Contact

Questions or deletion requests: open an issue at
<https://github.com/fivenet-app/plugin-streamdeck/issues>.

---

## Kurzfassung (Deutsch)

Das Plugin speichert Server-Adresse, Zugangsdaten, Session-Token, Charakterauswahl und
Action-Einstellungen ausschließlich lokal über die Stream-Deck-App. Daten werden nur an
den selbst konfigurierten FiveNet-Server übertragen. Es gibt keine Telemetrie, kein
Tracking und keine externen Dienste. Zum Löschen die Zugangsdaten im Login-Property-
Inspector leeren oder das Plugin samt Einstellungen deinstallieren.
