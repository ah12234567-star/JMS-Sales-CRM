# JMS Store OMS Delivery Plan

1. Persistence and schema/migration layer for orders, order items, order history/audit and inventory reservation state.
2. Server-side workflow engine with transition validation and role-aware cancellation.
3. Inventory reservation at approval; stock consumption at loaded; reservation release on eligible cancellation.
4. Sales CRM inbox and order detail modal.
5. Warehouse operations view.
6. A4 pick list / dispatch sheet.
7. Realtime subscription with safe polling fallback.
8. End-to-end scenario tests and preview validation.
9. Merge to main only after tests pass.
