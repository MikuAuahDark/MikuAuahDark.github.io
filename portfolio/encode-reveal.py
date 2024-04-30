import base64
import secrets
import sys


def transform_6_byte_key(key: bytes):
    fourbytekey = int.from_bytes(key[:4], "little")
    twobytekey = int.from_bytes(key[4:], "little")
    return ((fourbytekey * twobytekey) ^ twobytekey) & 0xFFFFFFFF


def get_xor_key(key: int):
    return (key & 0xFF) ^ ((key >> 8) & 0xFF)


def reveal(key: bytes, data: bytes):
    current_key = transform_6_byte_key(key)
    result: list[int] = []

    for byte in data:
        new_key = (current_key * 214013 + 2531011) & 0xFFFFFFFF
        result.append(byte ^ get_xor_key(new_key))
        current_key = new_key

    return bytes(result)


def main():
    sysrand = secrets.SystemRandom()
    input_data = sys.argv[1].encode("utf-8")
    key = sysrand.randbytes(6)
    encrypted = reveal(key, input_data)

    # Assert test
    decrypted = reveal(key, encrypted)
    assert input_data == decrypted

    print("Result:", str(base64.urlsafe_b64encode(encrypted), "utf-8"))
    print("Key:", str(base64.urlsafe_b64encode(key), "utf-8"))


if __name__ == "__main__":
    main()
