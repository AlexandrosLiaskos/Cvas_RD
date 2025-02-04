// Hash password for comparison
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Check if user is authenticated
function isAuthenticated() {
    return sessionStorage.getItem('authenticated') === 'true';
}

// Store authentication state
function setAuthenticated(value) {
    sessionStorage.setItem('authenticated', value);
}

// Show/hide auth modal
function toggleAuthModal(show) {
    const modal = document.getElementById('authModal');
    modal.style.display = show ? 'flex' : 'none';
}

// Hide main content
function toggleMainContent(show) {
    const mainContent = document.querySelector('.container');
    if (mainContent) {
        mainContent.style.display = show ? 'flex' : 'none';
    }
}

// Initialize auth check
async function initAuth() {
    // Correct password hash (replace this with your desired password's hash)
    const correctHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // hash of 'admin'

    if (!isAuthenticated()) {
        toggleMainContent(false);
        toggleAuthModal(true);

        // Handle authentication
        document.getElementById('authForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const hash = await hashPassword(password);

            if (hash === correctHash) {
                setAuthenticated(true);
                toggleAuthModal(false);
                toggleMainContent(true);
            } else {
                document.getElementById('authError').textContent = 'Incorrect password';
                document.getElementById('authError').style.display = 'block';
                document.getElementById('password').value = '';
            }
        });
    } else {
        toggleAuthModal(false);
        toggleMainContent(true);
    }
}

// Initialize auth when DOM is loaded
document.addEventListener('DOMContentLoaded', initAuth);