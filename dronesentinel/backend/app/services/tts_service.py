"""
TTS service — disabled. Stub kept so existing imports don't break.
"""

class _NoopTTS:
    def start(self):   pass
    def speak(self, text): pass
    def stop(self):    pass

tts_service = _NoopTTS()
