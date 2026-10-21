using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Cashback.Synthetic.Controller;

internal sealed class CbprParser
{
    internal static readonly IReadOnlyList<string> TestIds = Array.AsReadOnly(new[] {
        "test_unit.StrictSecrets.test_snapshot_read_once_and_immutable",
        "test_unit.StrictSecrets.test_byte_exact_formats_and_duplicates",
        "test_unit.StrictSecrets.test_failure_precedes_connect",
        "test_unit.StrictSecrets.test_password_public_string_contract",
        "test_unit.StrictSecrets.test_read_error",
        "test_unit.Scram.test_bounds", "test_unit.Scram.test_malformed",
        "test_unit.Scram.test_capability_closed_and_error_safe",
        "test_unit.LoggingPreflight.test_valid", "test_unit.LoggingPreflight.test_guc_rows",
        "test_unit.LoggingPreflight.test_all_other_gates",
        "test_unit.LoggingPreflight.test_wrong_cluster"
    });
    private readonly byte[] line = new byte[255];
    private int used, records, state, index = 1;
    private bool eofSeen;
    internal int Passed { get; private set; }
    internal int Failures { get; private set; }
    internal int Errors { get; private set; }
    internal int Skipped { get; private set; }
    internal bool Accepted { get; private set; }
    internal bool Complete { get; private set; }
    internal string? Invalid { get; private set; }

    internal void Feed(ReadOnlySpan<byte> data)
    {
        if (Invalid != null) return;
        if (eofSeen) { Complete = false; Invalid = "INPUT_AFTER_PROTOCOL_EOF"; return; }
        foreach (byte b in data)
        {
            if (state == 5 || Complete) { Invalid = "EXTRA_PROTOCOL_BYTES"; return; }
            if (b == 10)
            {
                if (++records > 27) { Invalid = "EXTRA_PROTOCOL_RECORD"; return; }
                Consume(Encoding.ASCII.GetString(line, 0, used));
                used = 0;
                if (Invalid != null) return;
            }
            else
            {
                if (b < 32 || b > 126) { Invalid = "INVALID_PROTOCOL_BYTE"; return; }
                if (used == 255) { Invalid = "PROTOCOL_LINE_TOO_LONG"; return; }
                line[used++] = b;
            }
        }
    }
    private void Consume(string value)
    {
        string id = index.ToString("D2", CultureInfo.InvariantCulture);
        switch (state)
        {
            case 0:
                if (value != "CBPR1|DELIVERY_ACCEPTED") break;
                Accepted = true; state = 1; return;
            case 1:
                if (value != "CBPR1|TEST_RUN_STARTED|count=12") break;
                state = 2; return;
            case 2:
                if (value != "CBPR1|TEST_BEGIN|index=" + id) break;
                state = 3; return;
            case 3:
                string prefix = "CBPR1|TEST_END|index=" + id + "|status=";
                if (value == prefix + "PASS") Passed++;
                else if (value == prefix + "FAIL") Failures++;
                else if (value == prefix + "ERROR") Errors++;
                else if (value == prefix + "SKIP") Skipped++;
                else break;
                state = index++ == 12 ? 4 : 2; return;
            case 4:
                string expected = FormattableString.Invariant(
                    $"CBPR1|TEST_RUN_COMPLETED|started=12|passed={Passed}|failures={Failures}|errors={Errors}|skipped={Skipped}|guards=0");
                if (value != expected) break;
                state = 5; return;
        }
        Invalid = "RESULT_PROTOCOL_INVALID";
    }
    internal void Eof()
    {
        if (eofSeen) { Invalid = "DUPLICATE_PROTOCOL_EOF"; Complete = false; return; }
        eofSeen = true;
        Complete = Invalid == null && used == 0 && state == 5 && records == 27;
        // A valid prefix at EOF is incomplete, not a contradictory record.
    }
}

internal static class SnapshotFrame
{
    internal const string CommonHash = "634C1FBCDEE3D5F123901881539A2193B7899CD2053502A12B3152685E3231C0";
    internal const string ProvisionHash = "CB9833D4505874CBA4276A74A9AAD268611B5EBED6DDB101882925547DF82A96";
    internal static void Verify(byte[] common, byte[] provision)
    {
        Native.Require(common.Length == 7558 && provision.Length == 1666, "SNAPSHOT_SIZE_MISMATCH");
        Native.Require(Convert.ToHexString(SHA256.HashData(common)) == CommonHash &&
            Convert.ToHexString(SHA256.HashData(provision)) == ProvisionHash, "SNAPSHOT_HASH_MISMATCH");
    }
    internal static byte[] Encode(byte[] common, byte[] provision)
    {
        Verify(common, provision);
        byte[] result = Encoding.ASCII.GetBytes("CBPT1|" + Convert.ToBase64String(common) + "|" +
            Convert.ToBase64String(provision) + "\n");
        Native.Require(result.Length == 12312 && result.Length <= 16384, "FRAME_SIZE_INVALID");
        return result;
    }
}
