(function () {
    var STORAGE_KEY = "fivenet.language";
    var messages = {
        en: {
            "login.pageTitle": "FiveNet Login",
            "login.section": "Login",
            "login.serverUrl": "Server URL",
            "login.username": "Username",
            "login.password": "Password",
            "login.autoRelogin": "Automatic login",
            "login.autoReloginHint": "Sign in again automatically when the login expires",
            "login.language": "Language",
            "login.submit": "Sign in",
            "login.hint": "After signing in, activate the desired character with the \"Select Character\" key.",
            "login.connecting": "Connecting...",
            "login.missingFields": "Please fill in all fields",
            "login.sent": "Login sent...",
            "login.error": "Error: {message}",
            "login.signedInAs": "Signed in as {name}",
            "login.sessionFailed": "Session could not be loaded",
            "login.charNeeded": "Please select a character",
            "login.success": "Login successful",
            "login.unknown": "Unknown",

            "char.pageTitle": "Select Character",
            "char.label": "Character",
            "char.placeholder": "— Select character —",
            "char.loading": "Loading characters...",
            "char.hint": "The selection is saved as the configured character of this key. The switch happens when you press the key. Without a selection, pressing the key cycles to the next available character. Characters locked by the FiveNet character switch lock are marked with a padlock; they can still be configured and become selectable once they are unlocked.",
            "char.locked": "Locked by the FiveNet character switch lock – can be configured",
            "char.active": "Active: {name}",
            "char.none": "No character active. Check login and character selection.",
            "char.empty": "No characters loaded. Check the login.",
            "char.noResponse": "No response from the plugin. Is the session running? Reopen the property inspector if needed.",

            "join.pageTitle": "Join Unit",
            "join.label": "Unit",
            "join.placeholder": "— Select unit —",
            "join.loading": "Loading units...",
            "join.hint": "The selection is saved. Joining happens when you press the key on the Stream Deck.",
            "join.current": "Current: {name}",
            "join.none": "No unit yet. Select a unit, then press the key.",
            "join.empty": "No units loaded. Check the server settings or session.",
            "join.noResponse": "No response from the plugin. Is the session running? Reopen the property inspector if needed.",

            "dispatchSet.pageTitle": "Set Dispatch Status",
            "dispatchSet.status": "Status",
            "dispatchSet.enroute": "En route",
            "dispatchSet.onscene": "On scene",
            "dispatchSet.assistance": "Assistance",
            "dispatchSet.completed": "Completed",

            "take.pageTitle": "Accept or Decline Dispatch",
            "take.action": "Action",
            "take.accept": "Accept",
            "take.decline": "Decline",

            "unitStatus.pageTitle": "Unit Status",
            "unitStatus.status": "Status",
            "unitStatus.available": "Available",
            "unitStatus.busy": "Busy",
            "unitStatus.onbreak": "On break",
            "unitStatus.unavailable": "Unavailable"
        },
        de: {
            "login.pageTitle": "FiveNet Login",
            "login.section": "Anmeldung",
            "login.serverUrl": "Server-URL",
            "login.username": "Benutzername",
            "login.password": "Passwort",
            "login.autoRelogin": "Automatische Anmeldung",
            "login.autoReloginHint": "Bei abgelaufenem Login automatisch neu anmelden",
            "login.language": "Sprache",
            "login.submit": "Anmelden",
            "login.hint": "Nach der Anmeldung den gewünschten Charakter mit der Taste „Charakter auswählen“ aktivieren.",
            "login.connecting": "Verbinde...",
            "login.missingFields": "Bitte alle Felder ausfüllen",
            "login.sent": "Login gesendet...",
            "login.error": "Fehler: {message}",
            "login.signedInAs": "Angemeldet als {name}",
            "login.sessionFailed": "Sitzung konnte nicht geladen werden",
            "login.charNeeded": "Bitte Charakter auswählen",
            "login.success": "Login erfolgreich",
            "login.unknown": "Unbekannt",

            "char.pageTitle": "Charakter auswählen",
            "char.label": "Charakter",
            "char.placeholder": "— Charakter wählen —",
            "char.loading": "Charaktere werden geladen...",
            "char.hint": "Die Auswahl wird sofort als konfigurierter Charakter dieser Taste gespeichert. Der Wechsel erfolgt durch einen Druck auf die Taste. Ohne Konfiguration wechselt der Tastendruck zum nächsten verfügbaren Charakter. Durch die Charwechselsperre (FiveNet) gesperrte Charaktere sind mit einem Vorhängeschloss markiert; sie können trotzdem festgelegt werden und sind auswählbar, sobald sie entsperrt sind.",
            "char.locked": "Durch die FiveNet-Charwechselsperre gesperrt – kann festgelegt werden",
            "char.active": "Aktiv: {name}",
            "char.none": "Kein Charakter aktiv. Login und Charakterwahl prüfen.",
            "char.empty": "Keine Charaktere geladen. Login prüfen.",
            "char.noResponse": "Keine Antwort vom Plugin. Läuft die Sitzung? PI ggf. neu öffnen.",

            "join.pageTitle": "Einheit beitreten",
            "join.label": "Einheit",
            "join.placeholder": "— Einheit wählen —",
            "join.loading": "Einheit wird geladen...",
            "join.hint": "Die Auswahl wird gespeichert. Der Beitritt erfolgt durch einen Druck auf die Taste am Stream Deck.",
            "join.current": "Aktuell: {name}",
            "join.none": "Noch keine Einheit. Einheit auswählen, dann Taste drücken.",
            "join.empty": "Keine Einheiten geladen. Server-Einstellungen bzw. Sitzung prüfen.",
            "join.noResponse": "Keine Antwort vom Plugin. Läuft die Sitzung? PI ggf. neu öffnen.",

            "dispatchSet.pageTitle": "Dispatch setzen",
            "dispatchSet.status": "Status",
            "dispatchSet.enroute": "Auf dem Weg",
            "dispatchSet.onscene": "Vor Ort",
            "dispatchSet.assistance": "Verstärkung",
            "dispatchSet.completed": "Abgeschlossen",

            "take.pageTitle": "Einsatz annehmen/ablehnen",
            "take.action": "Aktion",
            "take.accept": "Annehmen",
            "take.decline": "Ablehnen",

            "unitStatus.pageTitle": "Einheiten Status",
            "unitStatus.status": "Status",
            "unitStatus.available": "Verfügbar",
            "unitStatus.busy": "Beschäftigt",
            "unitStatus.onbreak": "Pause",
            "unitStatus.unavailable": "Nicht verfügbar"
        }
    };

    var language = "en";

    function normalizeLanguage(value) {
        return value === "de" ? "de" : "en";
    }

    function readStoredLanguage() {
        try {
            return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
        } catch (e) {
            return "en";
        }
    }

    function storeLanguage(value) {
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch (e) {
            // Storage may be unavailable; global settings remain authoritative.
        }
    }

    function t(key, fallback) {
        var value = messages[language][key];
        if (value === undefined) {
            value = messages.en[key];
        }
        return value === undefined ? (fallback === undefined ? key : fallback) : value;
    }

    function format(key, values) {
        return t(key).replace(/\{(\w+)\}/g, function (match, name) {
            return values && values[name] !== undefined ? String(values[name]) : match;
        });
    }

    function translateElement(el) {
        var key = el.getAttribute("data-i18n");
        if (key) {
            var text = t(key);
            if (el.tagName === "OPTION") {
                if (el.textContent !== text) {
                    el.textContent = text;
                    // sdpi-radio and sdpi-select rebuild their labels only when an
                    // option element is added; replacing it triggers that refresh.
                    var clone = el.cloneNode(true);
                    el.replaceWith(clone);
                }
            } else if (el.textContent !== text) {
                el.textContent = text;
            }
        }
        key = el.getAttribute("data-i18n-label");
        if (key) {
            el.setAttribute("label", t(key));
        }
        key = el.getAttribute("data-i18n-placeholder");
        if (key) {
            el.setAttribute("placeholder", t(key));
        }
        key = el.getAttribute("data-i18n-title");
        if (key) {
            document.title = t(key);
        }
    }

    function bindLanguageSelects() {
        var els = document.querySelectorAll('sdpi-select[setting="language"]');
        for (var i = 0; i < els.length; i += 1) {
            var el = els[i];
            if (el.__fivenetLanguageBound) {
                continue;
            }
            el.__fivenetLanguageBound = true;
            el.addEventListener("valuechange", function (event) {
                setLanguage(event.currentTarget.value);
            });
        }
    }

    function apply() {
        document.documentElement.lang = language;
        var els = document.querySelectorAll(
            "[data-i18n], [data-i18n-label], [data-i18n-placeholder], [data-i18n-title]"
        );
        for (var i = 0; i < els.length; i += 1) {
            translateElement(els[i]);
        }
        bindLanguageSelects();
        window.dispatchEvent(new CustomEvent("fivenet-language", { detail: { language: language } }));
    }

    function normalize(settings) {
        var next = normalizeLanguage(settings && settings.language);
        language = next;
        storeLanguage(next);
    }

    function setLanguage(value) {
        var next = normalizeLanguage(value);
        var changed = next !== language;
        language = next;
        storeLanguage(next);
        apply();
        return changed;
    }

    window.fivenetI18n = {
        t: t,
        format: format,
        apply: apply,
        setLanguage: setLanguage,
        get language() {
            return language;
        }
    };

    language = readStoredLanguage();
    apply();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply);
    }

    var client = window.SDPIComponents && window.SDPIComponents.streamDeckClient;
    if (!client) {
        return;
    }

    function loadSettings(attempt) {
        client
            .getGlobalSettings()
            .then(function (settings) {
                normalize(settings);
                apply();
            })
            .catch(function () {
                if (attempt < 3) {
                    setTimeout(function () {
                        loadSettings(attempt + 1);
                    }, (attempt + 1) * 1000);
                }
            });
    }

    loadSettings(0);

    client.didReceiveGlobalSettings.subscribe(function (event) {
        normalize(event && event.payload && event.payload.settings);
        apply();
    });

    client.sendToPropertyInspector.subscribe(function (event) {
        var payload = event && event.payload;
        if (payload && payload.event === "language") {
            setLanguage(payload.language);
        }
    });

    window.addEventListener("focus", function () {
        loadSettings(0);
    });
})();
