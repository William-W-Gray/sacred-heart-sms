"""
apps/trash/mixins.py
Drop into any ModelViewSet whose model is a SoftDeleteModel to turn
DELETE into a soft delete (recoverable from Trash) instead of a permanent one.
"""


class SoftDeleteViewSetMixin:
    def perform_destroy(self, instance):
        instance.soft_delete(by=self.request.user)
