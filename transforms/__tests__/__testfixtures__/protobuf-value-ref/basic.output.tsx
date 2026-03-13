import { ConnectError } from "@connectrpc/connect";
import { ErrorInfo, ErrorInfoSchema } from "@example/gen/google/rpc/error_details_pb";

try {
  await callApi();
} catch (err) {
  const details = ConnectError.from(err).findDetails(ErrorInfoSchema);
}
