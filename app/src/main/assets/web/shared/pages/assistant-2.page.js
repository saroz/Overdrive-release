/* Moved out of local/assistant.html (security fix F9: no inline scripts). */
document.addEventListener('DOMContentLoaded', function () {
    BYD.i18n.init().then(function () {
        BYD.core.init();
        GenAI.init();
        VoiceAssistantCard.init();
        TripBriefing.init();
    });
});
