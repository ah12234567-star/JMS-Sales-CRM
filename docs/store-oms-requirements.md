# Store OMS Requirements

Branch target: `feature/store-oms`

- Separate order, order item, and audit/history persistence.
- Workflow: new -> approved -> picking -> ready -> loaded -> out_for_delivery -> delivered.
- Cancellation requires reason; after ready only admin may cancel.
- Reserve inventory at approval; consume actual stock at loaded.
- Sales inbox with search/filter/status badges and full order modal.
- Warehouse view for picking/ready operational orders.
- A4 pick/dispatch sheet.
- Realtime UI updates.
- Full scenario testing before merge/deploy.
