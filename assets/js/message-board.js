(() => {
  'use strict';

  const API = '/api/confessions';
  const form = document.getElementById('confession-form');
  if (!form) return;

  const nameInput = document.getElementById('confession-name');
  const emailInput = document.getElementById('confession-email');
  const messageInput = document.getElementById('confession-message');
  const consentInput = document.getElementById('confession-consent');
  const submitButton = document.getElementById('confession-submit');
  const formStatus = document.getElementById('confession-form-status');
  const wallStatus = document.getElementById('confession-wall-status');
  const list = document.getElementById('confession-list');
  const counter = document.getElementById('message-count');
  const refreshButton = document.getElementById('confession-refresh');

  function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('is-error', isError);
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }

  function renderConfessions(confessions) {
    list.replaceChildren();
    if (!confessions.length) {
      const empty = document.createElement('p');
      empty.className = 'confession-empty';
      empty.textContent = 'There are no messages yet. You can be the first to leave a note.';
      list.appendChild(empty);
      return;
    }

    for (const confession of confessions) {
      const card = document.createElement('article');
      card.className = 'confession-entry';

      const heading = document.createElement('div');
      heading.className = 'confession-entry-heading';
      const author = document.createElement('h3');
      author.textContent = confession.name;
      const date = document.createElement('time');
      const timestamp = new Date(confession.created_at);
      date.dateTime = Number.isNaN(timestamp.getTime()) ? '' : timestamp.toISOString();
      date.textContent = Number.isNaN(timestamp.getTime())
        ? ''
        : timestamp.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
      heading.append(author, date);

      const message = document.createElement('p');
      message.className = 'confession-entry-message';
      message.textContent = confession.message;
      card.append(heading, message);
      list.appendChild(card);
    }
  }

  async function loadWall() {
    setStatus(wallStatus, 'Loading recent messages…');
    try {
      const data = await apiRequest(API);
      renderConfessions(data.confessions || []);
      setStatus(wallStatus, '');
    } catch (error) {
      renderConfessions([]);
      setStatus(
        wallStatus,
        `${error.message} Deploy this page as a Cloudflare Worker with a D1 database to enable the message board.`,
        true,
      );
    }
  }

  async function loadMyConfession() {
    try {
      const data = await apiRequest(`${API}/mine`);
      if (!data.confession) return;
      nameInput.value = data.confession.name;
      emailInput.value = data.confession.email;
      messageInput.value = data.confession.message;
      counter.textContent = String(messageInput.value.length);
      submitButton.textContent = 'Update my message';
      setStatus(formStatus, 'Your saved message is loaded. You can edit this one entry from this browser session.');
    } catch (error) {
      setStatus(formStatus, error.message, true);
    }
  }

  messageInput.addEventListener('input', () => {
    counter.textContent = String(messageInput.value.length);
  });

  refreshButton.addEventListener('click', loadWall);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(formStatus, '');

    if (!form.reportValidity()) return;
    if (!consentInput.checked) {
      setStatus(formStatus, 'Please confirm that your name and message will be public.', true);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Saving…';
    try {
      await apiRequest(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.value,
          email: emailInput.value,
          message: messageInput.value,
          consent: consentInput.checked,
        }),
      });
      submitButton.textContent = 'Update my message';
      setStatus(formStatus, 'Your message has been saved. You can update this entry from this browser session.');
      await loadWall();
    } catch (error) {
      submitButton.textContent = 'Publish message';
      setStatus(formStatus, error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  loadMyConfession();
  loadWall();
})();
