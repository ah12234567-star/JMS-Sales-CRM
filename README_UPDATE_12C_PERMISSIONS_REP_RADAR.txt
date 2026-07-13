JMS UPDATE 12C - Permissions + Rep Nearby Radar

Files:
- app.js only

Changes:
1) Customer Import is admin-only. Representatives and sales managers will not see the import button.
2) New Customer Radar is available to reps.
3) Radar has a district/nearby field so a rep can search around a specific neighborhood.
4) Leads created by a rep search are assigned to that rep automatically.
5) If a rep converts a lead to a customer, the customer is assigned to that rep.

Upload:
- Upload app.js in the GitHub root and replace the old app.js.
Commit message:
JMS Update 12C permissions rep nearby radar
