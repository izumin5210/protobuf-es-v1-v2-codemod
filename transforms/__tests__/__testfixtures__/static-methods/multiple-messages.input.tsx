import { User, Post } from "./gen/example_pb";

const user = User.fromBinary(new Uint8Array());
const post = Post.fromJsonString('{"title": "Hello"}');
