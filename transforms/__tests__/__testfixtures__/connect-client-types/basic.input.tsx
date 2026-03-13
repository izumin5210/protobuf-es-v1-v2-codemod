import { ConnectError, PromiseClient, createPromiseClient } from "@connectrpc/connect";
import type { ServiceType } from "@bufbuild/protobuf";
import { UserService } from "@example/gen/example/v1/example_pb";

function createClient<T extends ServiceType>(
  serviceType: T,
): PromiseClient<T> {
  return createPromiseClient(serviceType, transport);
}

const client: PromiseClient<typeof UserService> = createClient(UserService);
