import { PostService } from "@example/gen/example/v1/example_connect";
import { UserService } from "@example/gen/example/v1/example_connect";
import { PostResponse } from "@example/gen/example/v1/example_pb";

const client = getClient(PostService);
const token = getClient(UserService);
