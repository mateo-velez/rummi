// Utility for managing player's persistent identity across browser sessions
export const getPersistentId = () => {
  let id = localStorage.getItem('rummi-pid');
  if (!id) {
    id = 'p-' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem('rummi-pid', id);
  }
  return id;
};
