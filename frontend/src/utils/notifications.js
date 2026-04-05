export const showNotification = (title, message) => {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission === "granted") {
        new Notification(title, {
            body: message,
            icon: '/logo192.png' // Fallback icon
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                new Notification(title, {
                    body: message,
                    icon: '/logo192.png'
                });
            }
        });
    }
};
