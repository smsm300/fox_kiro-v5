import os
import sys
from waitress import serve
from fox_pos.wsgi import application

# Add current directory to path
sys.path.append(os.getcwd())

if __name__ == "__main__":
    print("------------------------------------------")
    print("🚀 Starting FOX ERP Production Server")
    print("🌐 URL: http://localhost:8000/app/")
    print("------------------------------------------")
    
    # Run the server
    # We use 0.0.0.0 to allow access from local network if needed
    serve(application, host='0.0.0.0', port=8000, threads=10)
