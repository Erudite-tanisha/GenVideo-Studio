import boto3
import os

s3 = boto3.client("s3")
BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

def generate_presigned_video_url(s3_key: str, expires_in: int = 3600) -> str:
    return s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": s3_key
        },
        ExpiresIn=expires_in
    )

# import boto3

# def generate_presigned_video_url(
#     bucket: str,
#     s3_key: str,
#     expires_in: int = 3600
# ) -> str:
#     """
#     Generate a presigned URL that streams video in browser.
#     """

#     s3 = boto3.client("s3")

#     return s3.generate_presigned_url(
#         ClientMethod="get_object",
#         Params={
#             "Bucket": bucket,
#             "Key": s3_key,
#             "ResponseContentDisposition": "inline",
#             "ResponseContentType": "video/mp4"
#         },
#         ExpiresIn=expires_in
#     )
