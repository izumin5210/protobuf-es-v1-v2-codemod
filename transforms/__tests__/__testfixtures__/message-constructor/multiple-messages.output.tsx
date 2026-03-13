import { create } from "@bufbuild/protobuf";
import { User, Post, UserSchema, PostSchema } from "./gen/example_pb";

const user = create(UserSchema, { name: "Homer" });
const post = create(PostSchema, { title: "Hello" });
