from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.access_level == 'ADMIN' or request.user.is_superuser
        )


class IsSalesManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.access_level in ('ADMIN', 'FULL_ACCESS') or request.user.is_superuser
        )


class IsPresalesOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.access_level in ('ADMIN', 'FULL_ACCESS', 'PILLAR_BASED') or request.user.is_superuser
        )
