import { ConnectError, Client, createClient as connectCreateClient } from "@connectrpc/connect";
import type { DescService } from "@bufbuild/protobuf";
import { UserService } from "@example/gen/example/v1/example_pb";

function createClient<T extends DescService>(
  serviceType: T,
): Client<T> {
  return connectCreateClient(serviceType, transport);
}

const client: Client<typeof UserService> = createClient(UserService);
