window.addEventListener('scroll', () => {
    const backgroundLogo = document.getElementById('background-logo');
    const scrollPosition = window.scrollY;
    const maxOpacity = 0.3;
    const scrollFactor = 10000; // Increase this value to slow down the appearance rate

    if (scrollPosition > 0) {
        let opacity = scrollPosition / scrollFactor;
        if (opacity > maxOpacity) opacity = maxOpacity;
        backgroundLogo.style.opacity = opacity;
    } else {
        backgroundLogo.style.opacity = 0;
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const sliders = document.querySelectorAll('.image-slider');

    sliders.forEach(slider => {
        let currentIndex = 0;
        const images = slider.querySelectorAll('img');
        const totalImages = images.length;

        // Show the first image
        images[currentIndex].classList.add('active');

        setInterval(() => {
            images[currentIndex].classList.remove('active');
            currentIndex = (currentIndex + 1) % totalImages;
            images[currentIndex].classList.add('active');
        }, 4500); // Change image every 3 seconds
    });
});
