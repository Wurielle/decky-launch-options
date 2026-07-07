"""
Vendored subset of ValvePython/vdf for binary VDF deserialization.

Source: https://github.com/ValvePython/vdf
License: MIT, see LICENSE in this directory.
"""

import struct
import sys
from io import BytesIO

try:
    from collections.abc import Mapping
except ImportError:
    from collections import Mapping

__version__ = "3.4"
__author__ = "Rossen Georgiev"

if sys.version_info[0] >= 3:
    int_type = int
else:
    int_type = long


class BASE_INT(int_type):
    def __repr__(self):
        return "%s(%d)" % (self.__class__.__name__, self)


class UINT_64(BASE_INT):
    pass


class INT_64(BASE_INT):
    pass


class POINTER(BASE_INT):
    pass


class COLOR(BASE_INT):
    pass


BIN_NONE = b"\x00"
BIN_STRING = b"\x01"
BIN_INT32 = b"\x02"
BIN_FLOAT32 = b"\x03"
BIN_POINTER = b"\x04"
BIN_WIDESTRING = b"\x05"
BIN_COLOR = b"\x06"
BIN_UINT64 = b"\x07"
BIN_END = b"\x08"
BIN_INT64 = b"\x0A"
BIN_END_ALT = b"\x0B"


def binary_loads(
    b,
    mapper=dict,
    merge_duplicate_keys=True,
    alt_format=False,
    raise_on_remaining=True,
):
    """
    Deserialize bytes containing binary VDF into a Python object.
    """
    if not isinstance(b, bytes):
        raise TypeError("Expected s to be bytes, got %s" % type(b))

    return binary_load(
        BytesIO(b),
        mapper,
        merge_duplicate_keys,
        alt_format,
        raise_on_remaining,
    )


def binary_load(
    fp,
    mapper=dict,
    merge_duplicate_keys=True,
    alt_format=False,
    raise_on_remaining=False,
):
    """
    Deserialize a file-like object containing binary VDF into a Python object.
    """
    if not hasattr(fp, "read") or not hasattr(fp, "tell") or not hasattr(fp, "seek"):
        raise TypeError(
            "Expected fp to be a file-like object with tell()/seek() and "
            "read() returning bytes"
        )
    if not issubclass(mapper, Mapping):
        raise TypeError("Expected mapper to be subclass of dict, got %s" % type(mapper))

    int32 = struct.Struct("<i")
    uint64 = struct.Struct("<Q")
    int64 = struct.Struct("<q")
    float32 = struct.Struct("<f")

    def read_string(fp, wide=False):
        buf, end = b"", -1
        offset = fp.tell()

        while end == -1:
            chunk = fp.read(64)

            if chunk == b"":
                raise SyntaxError("Unterminated cstring (offset: %d)" % offset)

            buf += chunk
            end = buf.find(b"\x00\x00" if wide else b"\x00")

        if wide:
            end += end % 2

        fp.seek(end - len(buf) + (2 if wide else 1), 1)

        result = buf[:end]

        if wide:
            result = result.decode("utf-16")
        elif bytes is not str:
            result = result.decode("utf-8", "replace")
        else:
            try:
                result.decode("ascii")
            except Exception:
                result = result.decode("utf-8", "replace")

        return result

    stack = [mapper()]
    current_bin_end = BIN_END if not alt_format else BIN_END_ALT

    for value_type in iter(lambda: fp.read(1), b""):
        if value_type == current_bin_end:
            if len(stack) > 1:
                stack.pop()
                continue
            break

        key = read_string(fp)

        if value_type == BIN_NONE:
            if merge_duplicate_keys and key in stack[-1]:
                nested = stack[-1][key]
            else:
                nested = mapper()
                stack[-1][key] = nested
            stack.append(nested)
        elif value_type == BIN_STRING:
            stack[-1][key] = read_string(fp)
        elif value_type == BIN_WIDESTRING:
            stack[-1][key] = read_string(fp, wide=True)
        elif value_type in (BIN_INT32, BIN_POINTER, BIN_COLOR):
            value = int32.unpack(fp.read(int32.size))[0]

            if value_type == BIN_POINTER:
                value = POINTER(value)
            elif value_type == BIN_COLOR:
                value = COLOR(value)

            stack[-1][key] = value
        elif value_type == BIN_UINT64:
            stack[-1][key] = UINT_64(uint64.unpack(fp.read(int64.size))[0])
        elif value_type == BIN_INT64:
            stack[-1][key] = INT_64(int64.unpack(fp.read(int64.size))[0])
        elif value_type == BIN_FLOAT32:
            stack[-1][key] = float32.unpack(fp.read(float32.size))[0]
        else:
            raise SyntaxError(
                "Unknown data type at offset %d: %s"
                % (fp.tell() - 1, repr(value_type))
            )

    if len(stack) != 1:
        raise SyntaxError("Reached EOF, but Binary VDF is incomplete")
    if raise_on_remaining and fp.read(1) != b"":
        fp.seek(-1, 1)
        raise SyntaxError(
            "Binary VDF ended at offset %d, but there is more data remaining"
            % (fp.tell() - 1)
        )

    return stack.pop()
