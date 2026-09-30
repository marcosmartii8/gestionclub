// Load saved background image on page load
const savedBackground = localStorage.getItem('backgroundImage');
if (savedBackground) {
    document.body.style.backgroundImage = `url('${savedBackground}')`;
}