document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.querySelector('.light-overlay');
    
    // Schedule the flickers
    setTimeout(() => flicker(1), 3000);
    setTimeout(() => flicker(2), 5000);
    setTimeout(() => flicker(3), 7500);
    
    // Finally fade out the light
    setTimeout(() => {
        overlay.style.opacity = '0';
    }, 3500);

    function flicker(count) {
        overlay.classList.add('flicker');
        setTimeout(() => {
            overlay.classList.remove('flicker');
        }, 500);
    }
});