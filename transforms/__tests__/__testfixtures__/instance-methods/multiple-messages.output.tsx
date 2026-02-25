import { toBinary, toJsonString } from "@bufbuild/protobuf";
import { User, Post, UserSchema, PostSchema } from "./gen/example_pb";

const user: User = new User({ name: "Homer" });
const post: Post = new Post({ title: "Hello" });
const userBytes = toBinary(UserSchema, user);
const postStr = toJsonString(PostSchema, post);
