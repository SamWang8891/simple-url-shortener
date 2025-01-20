import os
import sqlite3
from enum import StrEnum
from sqlite3 import Connection

dbfile = os.path.join(os.path.dirname(__file__), "data.db")


def create_record(original_url: str) -> str:
    """
    Create a new shorten URL record in the database
    :param original_url: The original URL to shorten
    :return: Shortened key
    """
    if not original_url.startswith(('https://', 'http://')):
        original_url = 'https://' + original_url

    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()

        cur.execute("SELECT short FROM urls WHERE orig = ?", (original_url,))
        result = cur.fetchone()
        if result and (existing_short_key := result[0]):
            return existing_short_key

        cur.execute("SELECT word FROM dict WHERE used = 0 ORDER BY RANDOM() LIMIT 1")
        shortened_key = cur.fetchone()[0]

        cur.execute("UPDATE dict SET used = 1 WHERE word = ?", (shortened_key,))
        cur.execute("INSERT INTO urls (orig, short) VALUES (?, ?)", (original_url, shortened_key))
        con.commit()
        return shortened_key


def delete_record(url: str) -> bool:
    """
    Delete the record from the database
    :param url: The URL to delete, see app.py (/api/v1/delete_record) for the detailed accepted types
    :return: True if the record is deleted, False otherwise
    """
    with sqlite3.connect(dbfile) as con:
        url = url.lstrip('/')  # Prevent user input the shortened part starting with "/" like "/apple"

        # Check original URL
        ### Is Missing protocol
        if not (url.startswith('https://') or url.startswith('http://')):
            mod_url = 'https://' + url
            if short_str := search(mod_url, query_type=UrlRowType.ORIG, response_type=UrlRowType.SHORT, con=con):
                delete(con, short_str)
                return True

        ### Is a complete URL
        if short_str := search(url, query_type=UrlRowType.ORIG, response_type=UrlRowType.SHORT, con=con):
            delete(con, short_str)
            return True

        # Check short URL
        ### Is a short only
        if short_str := search(url, query_type=UrlRowType.SHORT, response_type=UrlRowType.SHORT, con=con):
            delete(con, short_str)
            return True

        # No matching record
        return False


def purge_all_records():
    """
    Purge all records in the database
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        cur.execute("DELETE FROM urls")
        cur.execute("UPDATE dict SET used = 0;")
        con.commit()


class UrlRowType(StrEnum):
    """
    Enum for the URL row type.
    """
    SHORT = "short"
    ORIG = "orig"


def search(
        url: str,
        query_type: UrlRowType = UrlRowType.SHORT,  # may be "orig" or "short"
        response_type: UrlRowType = UrlRowType.ORIG,  # may be "orig" or "short"
        con: Connection = None
) -> str | None:
    """
    Search for the linked short -> orig or orig -> short URL or verify if the URL exists
    :param url: The URL to search/verify
    :param query_type: The type of URL to search from
    :param response_type: The type of URL to return
    :param con: The connection to the database
    :return: The corresponding URL if found, None otherwise
    """
    tmp_con: bool = con is None
    if tmp_con: con = sqlite3.connect(dbfile)

    cur = con.cursor()
    response = cur.execute(f"SELECT {response_type} FROM urls WHERE {query_type} = ?", (url,)).fetchone()

    if tmp_con: con.close()
    if not response: return None
    return response[0]


def delete(
        con,
        unused_short_word: str
):
    """
    Delete the record from the database
    :param con: The connection to the database
    :param unused_short_word:
    :return:
    """
    cur = con.cursor()
    cur.execute(f"DELETE FROM urls WHERE short = ?", (unused_short_word,))
    cur.execute("UPDATE dict SET used = 0 WHERE word = ?", (unused_short_word,))
    con.commit()


def get_all_records() -> dict[str, str]:
    """
    Get all records from the database
    :return: A dictionary of all records
    """
    with sqlite3.connect(dbfile) as con:
        cur = con.cursor()
        cur.execute("SELECT orig, short FROM urls")
        records = cur.fetchall()

        return dict(records)
