// Shared API and HTTP request functions

const SERVER_BASE = (function(){
  try {
    const host = window.location.host;
    return `${window.location.protocol}//${host}:80`;
  } catch (e) {}
  return 'http://localhost:80';
})();

// HTTP POST request
function addDataToServer(path, payload) {
  const url = `${SERVER_BASE}${path}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json().catch(() => ({}));
  }).catch(err => {
    console.warn('sendToServer error:', err);
  });
}

// HTTP PUT request
function updateDataToServer(path, payload) {
  const url = `${SERVER_BASE}${path}`;
  return fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json().catch(() => ({}));
  }).catch(err => {
    console.warn('updateDataToServer error:', err);
  });
}

// HTTP GET request
function getFromServer(path) {
  const url = `${SERVER_BASE}${path}`;
  return fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  }).then(res => {
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json();
  }).catch(err => {
    console.warn('getFromServer error:', err);
  });
}

// HTTP DELETE request
function deleteFromServer(path, payload) {
  // send DELETE to server and return the fetch promise so caller can await it
  try {
    return fetch(`${SERVER_BASE}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    }).then(res =>{
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json();
    }).catch(err => {
      console.warn('Failed to notify server of deletion:', err);
      return null;
    });
  } catch (e) {
    console.warn('Error sending delete to server:', e);
    return Promise.resolve(null);
  }
}

// Handle admin authentication for sensitive operations
async function sendAuthenticatedRequest(endpoint, payload) {
  const credentials = await promptForAdminCredentials();
  if (!credentials) return;

  const adminResponse = await addDataToServer('/api/admin/', { adminName: credentials.name, adminPassword: credentials.password });
  if (adminResponse && adminResponse.authenticated) {
    return updateDataToServer(endpoint, payload);
  } else {
    alert('管理员验证失败，请检查用户名和密码！');
  }
}

// Prompt for admin credentials
function promptForAdminCredentials() {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.id = 'admin-modal';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 400px; width: 90%;';
    
    const title = document.createElement('h3');
    title.textContent = '管理员验证';
    title.style.cssText = 'margin-top: 0; margin-bottom: 20px; color: #333;';
    
    const nameLabel = document.createElement('div');
    nameLabel.textContent = '用户名：';
    nameLabel.style.cssText = 'margin-bottom: 8px; font-size: 14px; color: #666;';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; margin-bottom: 15px;';
    
    const passwordLabel = document.createElement('div');
    passwordLabel.textContent = '密码：';
    passwordLabel.style.cssText = 'margin-bottom: 8px; font-size: 14px; color: #666;';
    
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; margin-bottom: 20px;';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
    
    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.style.cssText = 'padding: 8px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
    okBtn.onclick = () => {
      document.body.removeChild(container);
      resolve({ name: nameInput.value, password: passwordInput.value });
    };
    // Allow pressing Enter to confirm
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        okBtn.click();
      }
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding: 8px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;';
    cancelBtn.onclick = () => {
      document.body.removeChild(container);
      resolve(null);
    };
    
    btnContainer.appendChild(okBtn);
    btnContainer.appendChild(cancelBtn);
    modal.appendChild(title);
    modal.appendChild(nameLabel);
    modal.appendChild(nameInput);
    modal.appendChild(passwordLabel);
    modal.appendChild(passwordInput);
    modal.appendChild(btnContainer);
    container.appendChild(modal);
    document.body.appendChild(container);
    nameInput.focus();
  });
}

// Sync data from server
async function syncDataFromServer() {
  data = await getFromServer('/api/main');
  dataOpens = await getFromServer('/api/opens');
}
