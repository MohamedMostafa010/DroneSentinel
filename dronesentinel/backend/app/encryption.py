import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes
from .config import ENCRYPTION_KEY_FILE


class EncryptionManager:
    def __init__(self):
        self.key_file = ENCRYPTION_KEY_FILE
        self.key = self._load_or_generate_key()

    def _load_or_generate_key(self):
        os.makedirs(os.path.dirname(self.key_file), exist_ok=True)
        if os.path.exists(self.key_file):
            with open(self.key_file, "rb") as f:
                return f.read()
        key = get_random_bytes(32)
        with open(self.key_file, "wb") as f:
            f.write(key)
        return key

    def encrypt_file(self, input_path: str, output_path: str):
        cipher = AES.new(self.key, AES.MODE_CBC)
        with open(input_path, "rb") as f:
            data = f.read()
        with open(output_path, "wb") as f:
            f.write(cipher.iv + cipher.encrypt(pad(data, AES.block_size)))

    def decrypt_file(self, input_path: str, output_path: str):
        with open(input_path, "rb") as f:
            enc_data = f.read()
        cipher = AES.new(self.key, AES.MODE_CBC, enc_data[:16])
        with open(output_path, "wb") as f:
            f.write(unpad(cipher.decrypt(enc_data[16:]), AES.block_size))
