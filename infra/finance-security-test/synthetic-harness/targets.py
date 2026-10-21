"""Read current parent sources without importing or executing provision.main()."""
import types
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent

def load_targets():
    common = types.ModuleType('_synthetic_common')
    common.__file__ = str(ROOT / 'common.py')
    exec(compile((ROOT / 'common.py').read_text(encoding='utf-8'), common.__file__, 'exec'), common.__dict__)
    provision = types.ModuleType('_synthetic_provision')
    provision.__file__ = str(ROOT / 'provision.py')
    with patch.dict('sys.modules', {'common': common}):
        exec(compile((ROOT / 'provision.py').read_text(encoding='utf-8'), provision.__file__, 'exec'), provision.__dict__)
    return common, provision
