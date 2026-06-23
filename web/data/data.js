// Sample data. Replaced when scripts\Get-CAReport.ps1 runs.
window.CERT_DATA = {
    "generatedAt": "2026-05-13T08:00:00.000Z",
    "windowDays": 365,
    "windowStart": "2025-05-13T08:00:00.000Z",
    "caConfig": "(sample data — run scripts\\Get-CAReport.ps1)",
    "issued": [
        { "RequestID": "1001", "Requester": "CONTOSO\\svc-iis",   "CommonName": "web01.contoso.com",   "Template": "WebServer",      "SerialNumber": "1a2b3c4d", "NotBefore": "2025-09-12T10:14:00.000Z", "NotAfter": "2027-09-12T10:14:00.000Z", "Status": "Issued" },
        { "RequestID": "1002", "Requester": "CONTOSO\\alice",     "CommonName": "alice@contoso.com",   "Template": "User",           "SerialNumber": "2b3c4d5e", "NotBefore": "2025-10-03T09:00:00.000Z", "NotAfter": "2026-10-03T09:00:00.000Z", "Status": "Issued" },
        { "RequestID": "1003", "Requester": "CONTOSO\\svc-iis",   "CommonName": "api.contoso.com",     "Template": "WebServer",      "SerialNumber": "3c4d5e6f", "NotBefore": "2025-11-21T16:45:00.000Z", "NotAfter": "2027-11-21T16:45:00.000Z", "Status": "Issued" },
        { "RequestID": "1004", "Requester": "CONTOSO\\bob",       "CommonName": "bob@contoso.com",     "Template": "User",           "SerialNumber": "4d5e6f70", "NotBefore": "2026-01-08T08:11:00.000Z", "NotAfter": "2027-01-08T08:11:00.000Z", "Status": "Issued" },
        { "RequestID": "1005", "Requester": "CONTOSO\\svc-vpn",   "CommonName": "vpn.contoso.com",     "Template": "IPSecIntermediate","SerialNumber":"5e6f7081","NotBefore": "2026-02-14T12:00:00.000Z", "NotAfter": "2028-02-14T12:00:00.000Z", "Status": "Issued" },
        { "RequestID": "1006", "Requester": "CONTOSO\\svc-mail",  "CommonName": "mail.contoso.com",    "Template": "WebServer",      "SerialNumber": "6f708192", "NotBefore": "2026-03-02T14:30:00.000Z", "NotAfter": "2028-03-02T14:30:00.000Z", "Status": "Issued" },
        { "RequestID": "1007", "Requester": "CONTOSO\\alice",     "CommonName": "alice-mfa@contoso.com","Template":"SmartcardUser",  "SerialNumber": "708192a3", "NotBefore": "2026-04-11T07:55:00.000Z", "NotAfter": "2027-04-11T07:55:00.000Z", "Status": "Issued" },
        { "RequestID": "1008", "Requester": "CONTOSO\\svc-iis",   "CommonName": "shop.contoso.com",    "Template": "WebServer",      "SerialNumber": "8192a3b4", "NotBefore": "2026-05-01T11:22:00.000Z", "NotAfter": "2028-05-01T11:22:00.000Z", "Status": "Issued" }
    ],
    "failed": [
        { "RequestID": "1101", "Requester": "CONTOSO\\carol",  "CommonName": "carol@contoso.com",  "Template": "User",      "SubmittedWhen": "2025-12-04T13:01:00.000Z", "Disposition": "31", "Status": "Denied by policy module",        "StatusCode": "0x80094800" },
        { "RequestID": "1102", "Requester": "CONTOSO\\dave",   "CommonName": "dave@contoso.com",   "Template": "User",      "SubmittedWhen": "2026-01-19T09:44:00.000Z", "Disposition": "30", "Status": "The request subject name is invalid", "StatusCode": "0x80094001" },
        { "RequestID": "1103", "Requester": "CONTOSO\\svc-iis","CommonName": "old.contoso.com",    "Template": "WebServer", "SubmittedWhen": "2026-02-27T17:08:00.000Z", "Disposition": "31", "Status": "Denied by policy module",        "StatusCode": "0x80094800" }
    ]
};
