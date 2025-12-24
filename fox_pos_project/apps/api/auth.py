from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom token serializer to include user info in response"""
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add user info to response
        # Determine role based on is_staff flag
        role = 'admin' if self.user.is_staff else 'cashier'
        
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'name': self.user.first_name or self.user.username,
            'role': role,
        }
        
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view using our custom serializer"""
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """Logout view to blacklist refresh token"""
    
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({"message": "تم تسجيل الخروج بنجاح"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
