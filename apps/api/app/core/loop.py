import asyncio


def selector_loop_factory(use_subprocess: bool = False) -> asyncio.AbstractEventLoop:
    """psycopg async không chạy được trên ProactorEventLoop (mặc định của Windows).

    Linux/Docker/CI không cần. Chạy local trên Windows:
    uvicorn app.main:app --loop app.core.loop:selector_loop_factory
    """
    return asyncio.SelectorEventLoop()
