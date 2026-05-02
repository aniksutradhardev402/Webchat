import subprocess

def clean_db():
    print("[*] Cleaning database...")
    tables = ["message_status", "messages", "participants", "chats", "users"]
    truncate_query = f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE;"
    
    cmd = [
        "docker", "exec", "-i", "chat-server-db-1", 
        "psql", "-U", "postgres", "-d", "chatdb", 
        "-c", truncate_query
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print("[+] Database cleaned successfully.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[-] Error cleaning database: {e.stderr}")
        return False

if __name__ == "__main__":
    clean_db()
