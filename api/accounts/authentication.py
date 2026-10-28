from allauth.headless.contrib.rest_framework.authentication import XSessionTokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class MobileSessionAuthentication(XSessionTokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if "X-Session-Token" in request.headers and not result:
            raise AuthenticationFailed("Session expired. Sign in again.")
        return result

    def authenticate_header(self, request):
        return "X-Session-Token"
