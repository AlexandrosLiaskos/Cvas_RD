import secrets
import string

def generate_jwt_secret():
    return secrets.token_hex(32)

def generate_admin_password():
    # Generate a strong password with:
    # - uppercase letters
    # - lowercase letters
    # - digits
    # - special characters
    # - 16 characters long
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = ''.join(secrets.choice(alphabet) for i in range(16))
        if (any(c.islower() for c in password)
                and any(c.isupper() for c in password)
                and any(c.isdigit() for c in password)
                and any(c in "!@#$%^&*" for c in password)):
            break
    return password

# Generate secrets
jwt_secret = generate_jwt_secret()
admin_password = generate_admin_password()

print("\nGenerated Secrets for CVAS Resource Database:\n")
print("CVAS_JWT_SECRET:")
print("-" * 50)
print(jwt_secret)
print("\nCVAS_ADMIN_PASSWORD:")
print("-" * 50)
print(admin_password)
print("\nThese secrets are cryptographically secure.")
print("Store them safely in GitHub repository secrets.")