import type { ErrorInfo } from "@example/gen/google/rpc/error_details_pb";
import { ErrorInfoSchema } from "@example/gen/google/rpc/error_details_pb";
import { ConnectError } from "@connectrpc/connect";

function getDetails(err: ErrorInfo) {
  return ConnectError.from(err).findDetails(ErrorInfoSchema);
}
